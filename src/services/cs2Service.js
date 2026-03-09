const axios = require('axios');

const STEAM_INVENTORY_URL = 'https://steamcommunity.com/inventory';
const STEAM_VANITY_URL = 'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001';
const STEAM_CDN = 'https://community.cloudflare.steamstatic.com/economy/image';

/**
 * Resolve a Steam profile URL to a Steam ID64
 * Supports:
 *   - https://steamcommunity.com/profiles/76561198XXXXXXXXX
 *   - https://steamcommunity.com/id/username
 */
async function resolveSteamId(profileUrl) {
  const trimmed = profileUrl.trim().replace(/\/$/, '');

  // Direct numeric profile URL
  const profileMatch = trimmed.match(/\/profiles\/(\d{17})/);
  if (profileMatch) {
    return profileMatch[1];
  }

  // Vanity URL (e.g. /id/username)
  const vanityMatch = trimmed.match(/\/id\/([^/]+)/);
  if (vanityMatch) {
    const vanityName = vanityMatch[1];
    if (!process.env.STEAM_API_KEY) {
      throw new Error(
        'Vanity URL detected but STEAM_API_KEY is not set. ' +
        'Please use a direct profile URL (steamcommunity.com/profiles/76561...) ' +
        'or set STEAM_API_KEY in your .env file.'
      );
    }
    const res = await axios.get(STEAM_VANITY_URL, {
      params: { key: process.env.STEAM_API_KEY, vanityurl: vanityName }
    });
    const data = res.data?.response;
    if (!data || data.success !== 1) {
      throw new Error(`Could not resolve Steam vanity URL: ${vanityName}`);
    }
    return data.steamid;
  }

  throw new Error(
    'Invalid Steam profile URL. Expected format: ' +
    'https://steamcommunity.com/profiles/76561198XXXXXXXXX'
  );
}

/**
 * Fetch the CS2 inventory for a given Steam ID64
 * Returns: [{ marketHashName, count, iconUrl }]
 * Throws if inventory is private or empty
 */
async function fetchSteamInventory(steamId64) {
  let res;
  try {
    res = await axios.get(`${STEAM_INVENTORY_URL}/${steamId64}/730/2`, {
      params: { l: 'english', count: 5000 },
      timeout: 10000
    });
  } catch (err) {
    if (err.response?.status === 403) {
      throw new Error('Steam inventory is private. Make sure your CS2 inventory is set to public.');
    }
    throw new Error(`Failed to fetch Steam inventory: ${err.message}`);
  }

  const data = res.data;
  if (!data || data.success === false || data.success === 0) {
    throw new Error('Steam inventory is private or not found.');
  }

  const assets = data.assets || [];
  const descriptions = data.descriptions || [];

  // Build a lookup map: classid+instanceid → description
  const descMap = {};
  for (const desc of descriptions) {
    const key = `${desc.classid}_${desc.instanceid}`;
    descMap[key] = desc;
  }

  // Group assets by market_hash_name, cumulate counts
  const grouped = {};
  for (const asset of assets) {
    const key = `${asset.classid}_${asset.instanceid}`;
    const desc = descMap[key];
    if (!desc) continue;

    const name = desc.market_hash_name;
    if (!name) continue;

    if (!grouped[name]) {
      grouped[name] = {
        marketHashName: name,
        count: 0,
        iconUrl: desc.icon_url
          ? `${STEAM_CDN}/${desc.icon_url}/96fx96f`
          : null
      };
    }
    grouped[name].count += parseInt(asset.amount) || 1;
  }

  const skins = Object.values(grouped);

  if (skins.length === 0) {
    throw new Error('No CS2 items found in this inventory.');
  }

  return skins;
}

module.exports = { resolveSteamId, fetchSteamInventory };
