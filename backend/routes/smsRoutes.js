const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const twilioAccounts = require('../config/twilioConfig');

// Initialize Twilio clients with support for both auth types
const twilioClients = twilioAccounts.map(account => {
    if (account.apiKey && account.apiSecret) {
        return twilio(account.apiKey, account.apiSecret, { 
            accountSid: account.sid 
        });
    }
    return twilio(account.sid, account.token);
});

// Get all accounts
router.get('/accounts', (req, res) => {
    const safeAccounts = twilioAccounts.map(({ sid, number, balance, type, status }) => ({
        sid, number, balance, type, status
    }));
    res.json(safeAccounts);
});

// Refresh account info
router.get('/accounts/:sid/refresh', async (req, res) => {
    try {
        const account = twilioAccounts.find(a => a.sid === req.params.sid);
        if (!account) {
            return res.status(404).json({ success: false, error: 'Account not found' });
        }

        const client = twilio(account.sid, account.token);
        
        // Get account info from Twilio
        const twilioAccount = await client.api.accounts(account.sid).fetch();
        
        // Get account balance
        const balance = await client.balance.fetch();

        // Update local account info
        account.status = twilioAccount.status;
        account.balance = parseFloat(balance.balance);
        account.dateUpdated = new Date().toISOString();

        res.json({
            success: true,
            account: {
                sid: account.sid,
                number: account.number,
                balance: account.balance,
                type: account.type,
                status: account.status,
                dateUpdated: account.dateUpdated
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update account info
router.put('/accounts/:sid', async (req, res) => {
    try {
        const account = twilioAccounts.find(a => a.sid === req.params.sid);
        if (!account) {
            return res.status(404).json({ success: false, error: 'Account not found' });
        }

        const client = twilio(account.sid, account.token);
        
        // Update account on Twilio
        const twilioAccount = await client.api.accounts(account.sid).update({
            friendlyName: req.body.friendlyName,
            status: req.body.status
        });

        // Update local account info
        account.status = twilioAccount.status;
        account.friendlyName = twilioAccount.friendlyName;
        account.dateUpdated = new Date().toISOString();

        res.json({
            success: true,
            account: {
                sid: account.sid,
                number: account.number,
                balance: account.balance,
                type: account.type,
                status: account.status,
                friendlyName: account.friendlyName,
                dateUpdated: account.dateUpdated
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Refresh all accounts
router.post('/accounts', async (req, res) => {
    try {
        const { sid, token, apiKey, apiSecret, number, type } = req.body;

        if (!sid || (!token && (!apiKey || !apiSecret)) || !number) {
            return res.status(400).json({
                success: false,
                error: 'Account SID, credentials (Token or API Key+Secret), and Phone Number are required'
            });
        }

        // Create client based on provided credentials
        const client = apiKey && apiSecret ? 
            twilio(apiKey, apiSecret, { accountSid: sid }) :
            twilio(sid, token);

        // Verify credentials
        const twilioAccount = await client.api.accounts(sid).fetch();
        const balance = await client.balance.fetch();

        const newAccount = {
            sid,
            token, // Store if provided
            apiKey, // Store if provided
            apiSecret, // Store if provided
            number,
            type: type || 'Trial',
            status: twilioAccount.status,
            balance: parseFloat(balance.balance),
            dateAdded: new Date().toISOString(),
            dateUpdated: new Date().toISOString()
        };

        twilioAccounts.push(newAccount);
        twilioClients.push(client);

        // Return safe version without credentials
        const safeAccount = { ...newAccount };
        delete safeAccount.token;
        delete safeAccount.apiSecret;

        res.status(201).json({
            success: true,
            account: safeAccount
        });
    } catch (error) {
        handleTwilioError(error, res);
    }
});


// Add new account
router.post('/accounts', async (req, res) => {
    try {
        const { sid, token, number, type } = req.body;

        // Validate required fields
        if (!sid || !token || !number) {
            return res.status(400).json({
                success: false,
                error: 'SID, Token, and Phone Number are required'
            });
        }

        // Check if account already exists
        if (twilioAccounts.some(a => a.sid === sid || a.number === number)) {
            return res.status(400).json({
                success: false,
                error: 'Account with this SID or Phone Number already exists'
            });
        }

        // Verify account credentials
        try {
            const client = twilio(sid, token);
            const twilioAccount = await client.api.accounts(sid).fetch();
            const balance = await client.balance.fetch();

            // Create new account object
            const newAccount = {
                sid,
                token,
                number,
                type: type || 'Trial',
                status: twilioAccount.status,
                balance: parseFloat(balance.balance),
                dateAdded: new Date().toISOString(),
                dateUpdated: new Date().toISOString()
            };

            // Add to accounts array
            twilioAccounts.push(newAccount);

            // Add to Twilio clients array
            twilioClients.push(client);

            // Return safe version of account (without token)
            const safeAccount = { ...newAccount };
            delete safeAccount.token;

            res.json({
                success: true,
                account: safeAccount
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Twilio credentials'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// Get account usage
router.get('/accounts/:sid/usage', async (req, res) => {
    try {
        const { sid } = req.params;
        const account = twilioAccounts.find(a => a.sid === sid);
        
        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        const client = twilio(account.sid, account.token);
        
        // Get usage for last 6 months
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 5); // Go back 6 months
        
        const usage = await client.usage.records.list({
            category: 'sms',
            startDate: startDate.toISOString().slice(0,10),
            endDate: endDate.toISOString().slice(0,10)
        });

        // Group by month
        const monthlyUsage = {};
        usage.forEach(record => {
            const month = new Date(record.startDate).toLocaleString('default', { month: 'short' });
            monthlyUsage[month] = (monthlyUsage[month] || 0) + record.count;
        });

        res.json({
            success: true,
            usage: monthlyUsage
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get message status
router.get('/messages/:sid', async (req, res) => {
    try {
        const { sid } = req.params;
        const { accountIndex = 0 } = req.query;
        
        const client = twilioClients[accountIndex];
        if (!client) {
            return res.status(400).json({
                success: false,
                error: 'Invalid account index'
            });
        }

        const message = await client.messages(sid).fetch();
        
        res.json({
            success: true,
            message: {
                sid: message.sid,
                status: message.status,
                errorCode: message.errorCode,
                errorMessage: message.errorMessage,
                direction: message.direction,
                dateSent: message.dateSent,
                price: message.price,
                priceUnit: message.priceUnit
            }
        });
    } catch (error) {
        handleTwilioError(error, res);
    }
});

// Delete message
router.delete('/messages/:sid', async (req, res) => {
    try {
        const { sid } = req.params;
        const { accountIndex = 0 } = req.query;
        
        const client = twilioClients[accountIndex];
        if (!client) {
            return res.status(400).json({
                success: false,
                error: 'Invalid account index'
            });
        }

        await client.messages(sid).remove();
        
        res.status(204).send();  // Use 204 for successful deletion
    } catch (error) {
        handleTwilioError(error, res);
    }
});

// Add this to your existing smsRoutes.js
// Add this error handling middleware
const handleTwilioError = (error, res) => {
    switch (error.status) {
        case 401:
            return res.status(401).json({
                success: false,
                error: 'Invalid authentication credentials'
            });
        case 404:
            return res.status(404).json({
                success: false,
                error: 'Resource not found'
            });
        case 429:
            return res.status(429).json({
                success: false,
                error: 'Too many requests - please slow down your request rate'
            });
        default:
            return res.status(error.status || 500).json({
                success: false,
                error: error.message
            });
    }
};

// Send SMS
router.post('/send', async (req, res) => {
    try {
        const { to, message, accountIndex } = req.body;

        if (!to || !message) {  // Updated check
            return res.status(400).json({
                success: false,
                error: 'Recipient number and message are required'
            });
        }

        const selectedAccount = accountIndex !== undefined ?
            twilioAccounts[accountIndex] :
            twilioAccounts[Math.floor(Math.random() * twilioAccounts.length)];

        if (!selectedAccount) {
            return res.status(400).json({
                success: false,
                error: 'No valid Twilio account available'
            });
        }

        const client = twilio(selectedAccount.sid, selectedAccount.token);

        const messageClient = await client.messages.create({
            body: message,  // Use message here
            to: to,
            from: selectedAccount.number,
            // Add optional message tags as shown in documentation
            tags: {
                campaign_name: req.body.campaignName,
                message_type: req.body.messageType
            }
        });

        res.status(201).json({  // Use 201 for resource creation
            success: true,
            message: {
                sid: messageClient.sid,
                status: messageClient.status,
                to: messageClient.to,
                from: messageClient.from,
                body: messageClient.body,
                dateSent: messageClient.dateCreated,
                tags: messageClient.tags,
                price: messageClient.price,
                priceUnit: messageClient.price_unit
            }
        });

    } catch (error) {
        handleTwilioError(error, res);
    }
});

module.exports = router;