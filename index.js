const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const API_LOGIN_ID = process.env.AUTH_NET_LOGIN_ID;
const TRANSACTION_KEY = process.env.AUTH_NET_TRANSACTION_KEY;

app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  const order = req.body;

  const transactionRequest = {
    createTransactionRequest: {
      merchantAuthentication: {
        name: API_LOGIN_ID,
        transactionKey: TRANSACTION_KEY
      },
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: order.total_price,
        payment: {
          creditCard: {
            cardNumber: "4111111111111111",
            expirationDate: "2025-12"
          }
        },
        billTo: {
          firstName: order.billing_address?.first_name || "Shopify",
          lastName: order.billing_address?.last_name || "Customer",
          address: order.billing_address?.address1,
          city: order.billing_address?.city,
          state: order.billing_address?.province,
          zip: order.billing_address?.zip,
          country: order.billing_address?.country
        },
        lineItems: {
          lineItem: order.line_items.map(item => ({
            itemId: item.sku || item.product_id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price
          }))
        }
      }
    }
  };

  try {
    const response = await axios.post(
      'https://api.authorize.net/xml/v1/request.api',
      transactionRequest,
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log(response.data);
    res.sendStatus(200);
  } catch (error) {
    console.error('Authorize.Net Error:', error.response?.data || error.message);
    res.sendStatus(500);
  }
});

app.get('/', (req, res) => {
  res.send('Shopify Webhook Listener Running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
