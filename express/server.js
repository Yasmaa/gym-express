const express = require('express');
const awsServerlessExpress = require('aws-serverless-express');
const morgan = require('morgan');
const cors = require('cors');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
const stripe = require('stripe')("sk_test_51He27ZBv8NcqewMDi2H6qHWEVGnhuvSu8zPSu2uTuUJKCahX3f9wiXwk7v61oWZlNnnzjb7xNOQ9QEj0LiVHYsi9004VQOsyPK");
const htmlPages = require('./helpers/htmlPages');

const functionName = 'api';
const basePath = `/.netlify/functions/${functionName}/`;

const stripeWebhookSecret = 'whsec_AaTZeNgyyMDp5DyrTwAwLAiseGziKaPp';

const BASE_URL = 'https://gym-express.netlify.app';

const app = express(functionName);
app.use(awsServerlessExpressMiddleware.eventContext())

const router = express.Router();


app.use(cors());
app.use(morgan('dev'));
app.use('/.netlify/functions/api/stripe/webhook', express.raw({type: "*/*"}))
app.use(express.json());



app.use(express.urlencoded({ extended: true }));

router.get('/', (req, res) => {
  res.send('Expo Stripe Checkout API\nBuild v1.0.0')
});

router.get('/products', async (req, res) => {
  try {
    const result = [];
    res.json(result);
  } catch(err) {
    res.status(500).send('Internal Server Error');
  }
})

router.post('/checkout', async (req, res) => {
  
  try {

    /* 
      For the demonstration purpose, I am using req.body.items to create line_items, 
      but you shouldn't use it in production, mallicious users may change price of items in body before sending to server,
      rather get items from the database using id received in body.
    */


    const items = [
    {
      "_id": "5eb0520e41ca9ecc3e92939c",
      "amount": 799,
      "image": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=400&q=40",
      "name": "Classic Margherita",
      "quantity": 2,
    }
  ];

    const order_items = [];
    let amount = 0;
    for(let i=0; i<items.length; i++) {
      order_items.push({
        name: items[i].name,
        amount: items[i].amount*100,
        currency: 'inr',
        quantity: items[i].quantity,
        images: [items[i].image]
      });
      amount = amount + items[i].amount*items[i].quantity;
    }

    //const order = await database.createOrder({items: req.body.items, platform: req.body.platform, amount, createdAt: new Date().toISOString(), paymentStatus: 'pending'});

    let success_url = '';
    let cancel_url = '';
    if(1 === 'web') {
      success_url = `${BASE_URL}/.netlify/functions/api/payment/success?platform=web`;
      cancel_url = `${BASE_URL}/.netlify/functions/api/payment/cancel?platform=web`;
    }
    else {
      success_url = `${BASE_URL}/.netlify/functions/api/payment/success`;
      cancel_url = `${BASE_URL}/.netlify/functions/api/payment/cancel`;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: order_items,
      success_url,
      cancel_url,
      client_reference_id: "123".toString(),
      customer_email: 'email@example.com',
    });
    
    res.send({orderId: "123".toString(), sessionId: session.id});
  }
  catch(err) {
    res.status(500).send('Internal Server Error');
  }
})

/**
 * To redirect users to Stripe
 */
router.get('/web/checkout/redirect', async (req, res) => {
  res.send(htmlPages.checkoutHtmlPage('pk_test_51He27ZBv8NcqewMDKkw5SlttiC97g2KsYjiGKkvO1PYeGXUT8Ltu2maJGXfTywqSYIlqQ9ZyR4317lNgN1CGp0K900X4A096ih', req.query.sessionId));
})

router.get('/payment/success', (req, res) => {
   
  /**
   * Don't fulfill the purchase here. Rather use Webhooks to fulfill purchase.
   */
  if(req.query.platform === 'web') {
    res.send(htmlPages.checkoutSuccessHtmlPage());
  }
  else
    res.json({success: true});
})

router.get('/payment/cancel', (req, res) => {
  if(req.query.platform === 'web') {
    res.send(htmlPages.checkoutCanceledHtmlPage());
  }
  else
    res.json({success: false});
})

router.post('/stripe/webhook', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    let event;
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      // Fulfill the purchase...
      //const updatedOrder = await database.updateOrderPaymentStatus(session.client_reference_id, 'paid');
    }
  } catch (err) {
    console.log(err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  res.json({received: true});
});

router.get('/orders/:orderId', async (req, res) => {
  try {
    const result = [];
    console.log(result);
    res.json(result);
  } catch(err) {
    res.status(500).send('Internal Server Error');
  }
})


app.use(basePath, router);

router.use(awsServerlessExpressMiddleware.eventContext());

if(process.env.NODE_ENV !== 'production')
  app.listen(3000)

// Initialize awsServerlessExpress
const server = awsServerlessExpress.createServer(app);

// Export lambda handler
exports.handler = (event, context) => {
  return awsServerlessExpress.proxy(server, event, context)
}
