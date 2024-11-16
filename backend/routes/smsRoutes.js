const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const twilioAccounts = require('../config/twilioConfig');

// Initialize Twilio clients
const twilioClients = twilioAccounts.map(account => 
    twilio(account.sid, account.token)
);

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
router.post('/accounts/refresh-all', async (req, res) => {
    try {
        const refreshPromises = twilioAccounts.map(async (account) => {
            try {
                const client = twilio(account.sid, account.token);
                
                // Get account info and balance in parallel
                const [twilioAccount, balance] = await Promise.all([
                    client.api.accounts(account.sid).fetch(),
                    client.balance.fetch()
                ]);

                // Update local account info
                account.status = twilioAccount.status;
                account.balance = parseFloat(balance.balance);
                account.dateUpdated = new Date().toISOString();

                return {
                    success: true,
                    account: {
                        sid: account.sid,
                        number: account.number,
                        balance: account.balance,
                        type: account.type,
                        status: account.status,
                        dateUpdated: account.dateUpdated
                    }
                };
            } catch (error) {
                return {
                    success: false,
                    sid: account.sid,
                    error: error.message
                };
            }
        });

        const results = await Promise.all(refreshPromises);
        res.json(results);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
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

// Add this to your existing smsRoutes.js

// Send SMS
router.post('/send', async (req, res) => {
    try {
        const { to, message, accountIndex } = req.body;

        // Validate required fields
        if (!to || !message) {
            return res.status(400).json({
                success: false,
                error: 'Recipient number and message are required'
            });
        }

        // Select Twilio client
        let client;
        if (accountIndex !== undefined && twilioClients[accountIndex]) {
            client = twilioClients[accountIndex];
        } else {
            // Randomly select a client if no specific account is chosen
            const randomIndex = Math.floor(Math.random() * twilioClients.length);
            client = twilioClients[randomIndex];
        }

        if (!client) {
            return res.status(400).json({
                success: false,
                error: 'No valid Twilio account available'
            });
        }

        // Send message
        const result = await client.messages.create({
            body: message,
            to: to,
            from: twilioAccounts[accountIndex || 0].number // Use the corresponding account's number
        });

        res.json({
            success: true,
            message: {
                sid: result.sid,
                status: result.status,
                to: result.to,
                from: result.from,
                body: result.body,
                dateSent: result.dateCreated
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;