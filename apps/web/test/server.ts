import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Server MSW tunggal; uji dapat menambah handler sementara lewat `server.use(...)`. */
export const server = setupServer(...handlers);
