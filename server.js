const jsonServer = require('json-server');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const Memory = require('lowdb/adapters/Memory');
const fs = require('fs');
const path = require('path');

const app = jsonServer.create();
const dbFilePath = path.join(__dirname, 'db.json');
const adapter = process.env.NODE_ENV === 'production' ? new Memory() : new FileSync(dbFilePath);
const db = low(adapter);

if (process.env.NODE_ENV === 'production') {
  const dbData = JSON.parse(fs.readFileSync(dbFilePath, 'utf-8'));
  db.defaults(dbData).write();
}

const middlewares = jsonServer.defaults();
app.use(middlewares);
app.use(jsonServer.bodyParser);

// Middleware для проверки ключа в заголовках
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    const apiKey = req.headers['x-api-key'];
    const expectedApiKey = 'your-secret-api-key'; // Замените на ваш реальный ключ

    if (!apiKey || apiKey !== expectedApiKey) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  next();
});

// Custom route to get chain info with all parameters
app.get('/chains/:id/full', (req, res) => {
  const chainId = parseInt(req.params.id, 10);
  const chain = db.get('chains').find({ id: chainId }).value();
  if (!chain) {
    return res.status(404).json({ error: 'Chain not found' });
  }

  const shortName = db.get('shortNames').find({ chainId: chainId }).value();
  const chainIdValue = db.get('chainIds').find({ chainId: chainId }).value();
  const network = db.get('networks').find({ chainId: chainId }).value();
  const nativeCurrency = db.get('nativeCurrencies').find({ chainId: chainId }).value();
  const rpcUrls = db.get('rpcUrls').filter({ chainId: chainId }).map('url').value();
  const blockExplorerUrls = db.get('blockExplorerUrls').filter({ chainId: chainId }).map('url').value();

  const fullChainInfo = {
    ...chain,
    shortName: shortName ? shortName.shortName : null,
    chainIdValue: chainIdValue ? chainIdValue.chainIdValue : null,
    network: network ? network.network : null,
    nativeCurrency: nativeCurrency ? nativeCurrency : null,
    rpcUrls: rpcUrls,
    blockExplorerUrls: blockExplorerUrls
  };

  res.json(fullChainInfo);
});

app.use((req, res, next) => {
  req.app.db = db;
  next();
});

const router = jsonServer.router(db); // Используем базу данных из lowdb напрямую
app.use(router);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`JSON Server is running on port ${port}`);
});