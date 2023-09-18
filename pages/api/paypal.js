const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_SECRET;

const basePayPal = "https://api-m.sandbox.paypal.com";

const generateAccessToken = async () => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
    ).toString("base64");

    const response = await fetch(`${basePayPal}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await response.json();

    return await data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error);
  }
};

const createOrder = async (cart) => {
  // use the cart information passed from the front-end to calculate the purchase unit details
  console.log(
    "shopping cart information passed from the frontend createOrder() callback:",
    cart
  );

  const accessToken = await generateAccessToken();
  const payload = JSON.stringify({
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "EUR",
          value: cart.totalPrice,
          breakdown: {
            item_total: {
              currency_code: "EUR",
              value: cart.totalPrice,
            },
          },
        },

        items: cart.cartItems?.map((item) => {
          return {
            name: item.name,
            quantity: item.quantity,
            category: "PHYSICAL_GOODS",

            unit_amount: {
              currency_code: "EUR",
              value: item.price,
            },
          };
        }),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          brand_name: "EXAMPLE INC",
          locale: "it-IT",
          landing_page: "LOGIN",
          user_action: "PAY_NOW",
          return_url: "http://localhost:4200/success",
          cancel_url: "http://localhost:4200",
        },
      },
    },
  });

  const response = await fetch(`${basePayPal}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",

      Authorization: "Bearer " + accessToken,
    },
    body: payload,
  });

  return handleResponse(response);
};

async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (err) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,DELETE,PATCH,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
  // specific logic for the preflight request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method === "POST") {
    try {
      const cart = req.body;
      const { jsonResponse, httpStatusCode } = await createOrder(cart);
      res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
      const status = 500;
      console.error("Failed to create order:", error);
      res.status(status).json({ error: "Failed to create order." });
    }
  } else {
    res.setHeader("Allow", "POST");

    res.status(405).end("Method Not Allowed");
  }
}
