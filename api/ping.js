module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ status: 'ok', version: 'native-fetch-v3', timestamp: new Date().toISOString() });
};
