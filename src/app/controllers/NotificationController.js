import Notification from '../schemas/Notifications';
import User from '../models/User';

class NotificationController {
  //Listar notificações
  async index(req, res) {
    const isProvider = await User.findOne({
      where: { id: req.userId, provider: true },
    });

    if (!isProvider) {
      return res
        .status(401)
        .json({ error: 'Only provider can load notifications' });
    }

    const { limit = 20, page = 1 } = req.query;
    const notifications = await Notification.find({
      user: req.userId,
      read: false,
    })
      .sort({ createdAt: 'desc' })
      .limit(parseInt(limit));

    return res.json(notifications);
  }

  async update(req, res) {
    const isProvider = await User.findOne({
      where: { id: req.userId, provider: true },
    });

    if (!isProvider) {
      return res
        .status(401)
        .json({ error: 'Only provider can load notifications' });
    }

    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(401).json({ error: 'Notification is not found' });
    }

    return res.json(notification);
  }
}

export default new NotificationController();
