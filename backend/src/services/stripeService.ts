import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

export const createCheckoutSession = async (tenantId: string, customerEmail: string, priceId: string) => {
  return await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
    cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
    customer_email: customerEmail,
    client_reference_id: tenantId,
    metadata: { tenantId },
  });
};

export const createPortalSession = async (stripeCustomerId: string) => {
  return await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/billing`,
  });
};

export default stripe;
