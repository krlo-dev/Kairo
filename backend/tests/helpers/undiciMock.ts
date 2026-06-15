import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, type Dispatcher } from 'undici';

// Helper para mockear llamadas undici (la base de httpRequest).
// Uso típico en test:
//   const { agent, pool, restore } = setupMock('https://api.mercadolibre.com');
//   pool.intercept({ path: '/oauth/token', method: 'POST' }).reply(200, { ... });
//   // ... ejercitar código ...
//   restore();

export interface MockSetup {
  agent: MockAgent;
  pool: ReturnType<MockAgent['get']>;
  restore: () => void;
}

export function setupUndiciMock(origin: string): MockSetup {
  const originalDispatcher: Dispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  const pool = agent.get(origin);
  return {
    agent,
    pool,
    restore: () => {
      setGlobalDispatcher(originalDispatcher);
    },
  };
}
