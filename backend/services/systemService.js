import os from 'os';

export const fetchSystemStatus = () => {
  return {
    cpuLoad: os.loadavg()[0],
    freeMem: os.freemem(),
    totalMem: os.totalmem(),
    uptime: os.uptime()
  };
};
