import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../schemas/Notifications';
import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';

import CancellationMail from '../jobs/CancellationMail';
import Queue from '../../lib/Queue';

class AppointmentController {
  async index(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const appointments = await Appointment.findAll({
        where: { user_id: req.userId, canceled_at: null },
        attributes: ['id', 'date', 'past', 'cancelable'],
        order: ['date'],
        limit: limit,
        offset: (page - 1) * limit,
        include: [
          {
            model: User,
            as: 'provider',
            attributes: ['id', 'name'],
            include: [
              {
                model: File,
                as: 'avatar',
                attributes: ['id', 'path', 'url'],
              },
            ],
          },
        ],
      });

      res.json(appointments);
    } catch (error) {
      return res
        .status(500)
        .json({ error: 'Search appointments failed, try again.' });
    }
  }

  async store(req, res) {
    try {
      const schema = Yup.object().shape({
        provider_id: Yup.number().required(),
        date: Yup.date().required(),
      });

      await schema.validate(req.body).catch(err => {
        return res.status(400).json({ error: err.errors[0] });
      });

      /*
       * Verificar se o provider_id é de um usuario provider
       */
      const { provider_id, date } = req.body;

      const isProvider = await User.findOne({
        where: { id: provider_id, provider: true },
      });

      if (!isProvider) {
        return res
          .status(401)
          .json({ error: 'You can only create appointments with providers' });
      }

      /*
       * Check for past dates
       */
      const hourStart = startOfHour(parseISO(date));
      if (isBefore(hourStart, new Date())) {
        return res.status(400).json({ error: 'Past dates are not permitted' });
      }

      /*
       * Check date availability
       */
      const checkAvailability = await Appointment.findOne({
        where: {
          provider_id,
          canceled_at: null,
          date: hourStart,
        },
      });

      if (checkAvailability) {
        return res
          .status(400)
          .json({ error: 'Appointment date is not available' });
      }
      const appointment = await Appointment.create({
        user_id: req.userId,
        provider_id,
        date,
      });

      /*
       * Notify appointment provider
       */
      const user = await User.findByPk(req.userId);
      const formattedDate = format(
        hourStart,
        "'dia' dd 'de' MMMM', às' H:mm'h'",
        { locale: pt }
      );

      await Notification.create({
        content: `Novo agendamento de ${user.name} para ${formattedDate}`,
        user: provider_id,
      });

      return res.json(appointment);
    } catch (err) {
      return res
        .status(500)
        .json({ error: 'Create appointment failed, try again.' });
    }
  }

  async delete(req, res) {
    try {
      const appointment = await Appointment.findByPk(req.params.id, {
        include: [
          {
            model: User,
            as: 'provider',
            attributes: ['name', 'email'],
          },
          {
            model: User,
            as: 'user',
            attributes: ['name'],
          },
        ],
      });

      if (appointment.user_id !== req.userId) {
        return res.status(401).json({
          error: "You don't have permission to cancel this appointment",
        });
      }

      const dateWithSub = subHours(appointment.date, 2);
      if (isBefore(dateWithSub, new Date())) {
        return res.status(401).json({
          error: 'You can only cancel appointments 2 hour is advance',
        });
      }

      appointment.canceled_at = new Date();

      await appointment.save();

      //Envia email em segundo plano referente ao cancelamento do appointment
      await Queue.add(CancellationMail.key, {
        appointment,
      });

      return res.json(appointment);
    } catch (error) {
      return res.status(501).json(error);
    }
  }
}

export default new AppointmentController();
