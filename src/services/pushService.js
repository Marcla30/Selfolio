const webpush = require('web-push');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initializeVapidKeys() {
  // Skip initialization if no users exist yet
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log('No users yet, skipping VAPID initialization');
    return null;
  }
  
  let settings = await prisma.settings.findFirst();
  
  if (!settings || !settings.vapidPublicKey || !settings.vapidPrivateKey) {
    const vapidKeys = webpush.generateVAPIDKeys();
    
    if (!settings) {
      // Get first user to create settings
      const firstUser = await prisma.user.findFirst();
      if (!firstUser) return null;
      
      settings = await prisma.settings.create({
        data: {
          userId: firstUser.id,
          vapidPublicKey: vapidKeys.publicKey,
          vapidPrivateKey: vapidKeys.privateKey
        }
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          vapidPublicKey: vapidKeys.publicKey,
          vapidPrivateKey: vapidKeys.privateKey
        }
      });
    }
  }
  
  if (settings) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@portfoliotracker.com',
      settings.vapidPublicKey,
      settings.vapidPrivateKey
    );
  }
  
  return settings;
}

async function sendPushNotification(title, body, data = {}) {
  const settings = await prisma.settings.findFirst();
  
  if (!settings?.pushSubscriptions) return;
  
  const subscriptions = JSON.parse(settings.pushSubscriptions);
  const payload = JSON.stringify({ title, body, data });
  
  const promises = subscriptions.map(sub => 
    webpush.sendNotification(sub, payload).catch(err => {
      console.error('Push notification error:', err);
    })
  );
  
  await Promise.all(promises);
  
  await prisma.notification.create({
    data: { title, body, type: data.type || 'info', data, sent: true, sentAt: new Date() }
  });
}

module.exports = {
  initializeVapidKeys,
  sendPushNotification
};
