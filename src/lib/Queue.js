import Bee from 'bee-queue';
import CancellationMail from '../app/jobs/CancellationMail';
import redisConfig from '../config/redis';

const jobs = [CancellationMail];

class Queue {
  constructor() {
    this.queues = {};

    this.init();
  }

  //Carrega as filas
  init() {
    jobs.forEach(({ key, handle }) => {
      this.queues[key] = {
        bee: new Bee(key, {
          redis: redisConfig,
        }),
        handle,
      };
    });
  }

  //Adiciona um job na fila
  add(queue, job) {
    return this.queues[queue].bee.createJob(job).save();
  }

  //Processa os jobs das filas
  processQueue() {
    jobs.forEach(job => {
      const { bee, handle } = this.queues[job.key];

      //Processa fila e caso encontre algum erro executa a função handleFailure
      bee.on('failed', this.handleFailure).process(handle);
    });
  }

  handleFailure(job, err) {
    console.log(`Queue ${job.queue.name}: FAILED`, err);
  }
}

export default new Queue();
