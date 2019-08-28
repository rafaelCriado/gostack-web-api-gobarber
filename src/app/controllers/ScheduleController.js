import User from '../models/User';
import Appointment from '../models/Appointment';
import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { Op } from 'sequelize';

class ScheduleController {
  async index(req, res) {
    try {
      const checkUserProvider = await User.findOne({
        where: { id: req.userId, provider: true },
      });

      if (!checkUserProvider) {
        return res.status(401).json({ error: 'User is not a a provider' });
      }

      const { date } = req.query;
      const parsedDate = parseISO(date);

      const appointments = await Appointment.findAll({
        where: {
          provider_id: req.userId,
          canceled_at: null,
          date: {
            [Op.between]: [startOfDay(parsedDate), endOfDay(parsedDate)],
          },
        },
        order: ['date'],
      });

      return res.json(appointments);
    } catch (error) {
      return res
        .status(500)
        .json({
          error: 'Search appointments in schedule is failed, try again',
        });
    }
  }
}

export default new ScheduleController();
