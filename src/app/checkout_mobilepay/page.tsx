'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Extend the Window interface to include VippsCheckout
declare global {
  interface Window {
    VippsCheckout?: {
      init: (config: {
        checkoutFrontendUrl: string;
        checkoutToken: string;
        iFrameContainerId: string;
        language: string;
        onComplete: (params: any) => void;
        onCancel: () => void;
        onError: (error: any) => void;
      }) => void;
    };
  }
}

interface VippsMobilePayCheckoutProps {
  cart: { name: string; price: number; quantity: number }[];
  customerInfo: { [key: string]: any }; // Replace with a more specific type if available
  onComplete: (params: any) => void; // Replace 'any' with a specific type if available
  onCancel: () => void;
}

const VippsMobilePayCheckout: React.FC<VippsMobilePayCheckoutProps> = ({ cart, customerInfo, onComplete, onCancel }) => {
  const [checkoutSession, setCheckoutSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState('shipping'); // 'shipping', 'payment', 'confirmation'
  const [shippingAddress, setShippingAddress] = useState({
    firstName: '',
    lastName: '',
    street: '',
    postalCode: '',
    city: '',
    country: 'NO', // Default to Norway
    email: '',
    phone: ''
  });
  const [selectedShipping, setSelectedShipping] = useState<{
    id: string;
    brand: string;
    type: string;
    title: string;
    description: string;
    amount: { value: number; currency: string };
    eta: string;
  } | null>(null);
  const checkoutContainerRef = useRef(null);
  
  // Available shipping options
  const shippingOptions = [
    {
      id: "bring-home",
      brand: "BRING",
      type: "HOME_DELIVERY",
      title: "Bring home delivery",
      description: "Delivered to your doorstep",
      amount: {
        value: 9900, // 99 NOK in øre
        currency: "NOK"
      },
      eta: "1-3 business days"
    },
    {
      id: "postnord-pickup",
      brand: "POSTNORD",
      type: "PICKUP_POINT",
      title: "PostNord pickup point",
      description: "Collect from your nearest pickup point",
      amount: {
        value: 4900, // 49 NOK in øre
        currency: "NOK"
      },
      eta: "2-4 business days"
    },
    {
      id: "porterbuddy-express",
      brand: "PORTERBUDDY",
      type: "HOME_DELIVERY",
      title: "Porterbuddy Express",
      description: "Same-day delivery when order is placed before 3 PM",
      amount: {
        value: 14900, // 149 NOK in øre
        currency: "NOK"
      },
      eta: "Today or tomorrow"
    }
  ];

  // Calculate cart total (excluding shipping)
  const calculateCartTotal = () => {
    if (!cart || !cart.length) return 0;
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Calculate total including shipping
  const calculateTotal = () => {
    const cartTotal = calculateCartTotal();
    const shippingCost = selectedShipping ? selectedShipping.amount.value : 0;
    return cartTotal + shippingCost;
  };

  // Handle shipping method selection
  const handleShippingSelection = (option: {
    id: string;
    brand: string;
    type: string;
    title: string;
    description: string;
    amount: { value: number; currency: string };
    eta: string;
  }) => {
    setSelectedShipping(option);
  };

  // Handle shipping address form changes
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setShippingAddress(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Proceed to payment step
  const proceedToPayment = () => {
    // Validate shipping form
    const requiredFields = ['firstName', 'lastName', 'street', 'postalCode', 'city', 'email'];
    const missingFields = requiredFields.filter(field => !shippingAddress[field as keyof typeof shippingAddress]);
    
    if (missingFields.length > 0) {
      setError("Please fill out all required fields");
      return;
    }
    
    if (!selectedShipping) {
      setError("Please select a shipping method");
      return;
    }
    
    // Proceed to payment step
    setError(null);
    setStep('payment');
    initializeCheckout();
  };

  // Initialize Vipps MobilePay checkout
  const initializeCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      // Generate a unique reference for this order
      const orderReference = `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Create the request payload
      const payload = {
        amount: calculateTotal(),
        currency: "NOK",
        reference: orderReference,
        description: "Memorybear Order",
        shipping_options: [selectedShipping]
      };

      // Call your Django backend to create a checkout session
      const response = await axios.post('/checkout_mobilepay/create', payload);
      
      if (response.data && response.data.token) {
        setCheckoutSession(response.data);
        
        // Load the Vipps MobilePay Checkout SDK
        loadCheckoutSDK(response.data.token);
      } else {
        throw new Error("Invalid response from checkout API");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Failed to initialize checkout. Please try again.");
      setStep('shipping'); // Go back to shipping step on error
    } finally {
      setLoading(false);
    }
  };

  // Load the Vipps MobilePay Checkout SDK
  const loadCheckoutSDK = (token: string) => {
    // Create a script element if it doesn't exist already
    if (!document.getElementById('vipps-checkout-sdk')) {
      const script = document.createElement('script');
      script.id = 'vipps-checkout-sdk';
      script.src = 'https://checkout.vipps.no/vippsCheckoutSDK.js';
      script.async = true;
      
      script.onload = () => {
        // Initialize the SDK once loaded
        initializeSDK(token);
      };
      
      document.body.appendChild(script);
    } else {
      // Script already exists, just initialize the SDK
      initializeSDK(token);
    }
  };

  // Initialize the Vipps MobilePay SDK
  const initializeSDK = (token: string) => {
    if (window.VippsCheckout) {
      window.VippsCheckout.init({
        checkoutFrontendUrl: 'https://checkout.vipps.no',
        checkoutToken: token,
        iFrameContainerId: 'vipps-checkout-container',
        language: 'en',
        onComplete: (params) => handleCheckoutComplete(params),
        onCancel: () => handleCheckoutCancel(),
        onError: (error) => handleCheckoutError(error)
      });
    }
  };

  // Handle checkout completion
  const handleCheckoutComplete = (params: { reference: string; [key: string]: any }) => {
    console.log("Checkout completed successfully:", params);
    setStep('confirmation');
    
    // Poll the payment status to ensure it's completed
    pollPaymentStatus(params.reference);
    
    // Call the onComplete callback if provided
    if (onComplete) {
      onComplete(params);
    }
  };

  // Poll payment status to ensure it's complete
  const pollPaymentStatus = async (reference: string) => {
    try {
      // First attempt
      let status = await getPaymentStatus(reference);
      
      // If not completed, try a few more times
      if (status !== 'AUTHORIZED' && status !== 'CAPTURED') {
        setTimeout(async () => {
          status = await getPaymentStatus(reference);
          
          // Try once more after 2 seconds if still not complete
          if (status !== 'AUTHORIZED' && status !== 'CAPTURED') {
            setTimeout(async () => {
              await getPaymentStatus(reference);
            }, 2000);
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Error polling payment status:", err);
    }
  };

  // Get the payment status
  const getPaymentStatus = async (reference: string) => {
    try {
      const response = await axios.get(`/checkout_mobilepay/payment/${reference}`);
      return response.data.state;
    } catch (err) {
      console.error("Error getting payment status:", err);
      return null;
    }
  };

  // Handle checkout cancellation
  const handleCheckoutCancel = () => {
    setError("Checkout was cancelled.");
    setStep('shipping');
    
    // Call the onCancel callback if provided
    if (onCancel) {
      onCancel();
    }
  };

  // Handle checkout error
  const handleCheckoutError = (error: any) => {
    console.error("Checkout error:", error);
    setError("An error occurred during checkout. Please try again.");
    setStep('shipping');
  };

  // Render the confirmation step
  const renderConfirmation = () => {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 w-full max-w-lg text-center">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Thank you for your order!</h2>
          <p className="text-gray-600 mb-2">Your order has been successfully placed.</p>
          <p className="text-gray-600">You will receive a confirmation email shortly.</p>
        </div>
      </div>
    );
  };

  // Render the payment step
  const renderPayment = () => {
    return (
      <div className="w-full">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Payment</h2>
        
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <div className="text-gray-500">Loading payment options...</div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-medium mb-4 text-gray-700">Order Summary</h3>
              <div className="space-y-3 mb-4">
                {cart && cart.map((item, index) => (
                  <div key={index} className="flex justify-between pb-3 border-b border-gray-200">
                    <span className="text-gray-600">{item.quantity} x {item.name}</span>
                    <span className="font-medium">{item.price} NOK</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">
                  Shipping ({selectedShipping ? selectedShipping.title : 'Not selected'})
                </span>
                <span className="font-medium">{selectedShipping ? selectedShipping.amount.value / 100 : 0} NOK</span>
              </div>
              <div className="flex justify-between pt-4 font-semibold text-lg">
                <span>Total</span>
                <span>{calculateTotal() / 100} NOK</span>
              </div>
            </div>
            
            <div id="vipps-checkout-container" ref={checkoutContainerRef} className="min-h-96"></div>
            
            <div className="flex justify-start mt-6">
              <button 
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                onClick={() => setStep('shipping')}
                disabled={loading}
              >
                Back to shipping
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render the shipping step
  const renderShipping = () => {
    return (
      <div className="w-full">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Shipping Information</h2>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        
        <div className="mb-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First Name *</label>
              <input 
                type="text" 
                id="firstName" 
                name="firstName" 
                value={shippingAddress.firstName} 
                onChange={handleAddressChange} 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last Name *</label>
              <input 
                type="text" 
                id="lastName" 
                name="lastName" 
                value={shippingAddress.lastName} 
                onChange={handleAddressChange} 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="street" className="block text-sm font-medium text-gray-700">Street Address *</label>
            <input 
              type="text" 
              id="street" 
              name="street" 
              value={shippingAddress.street} 
              onChange={handleAddressChange} 
              required 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700">Postal Code *</label>
              <input 
                type="text" 
                id="postalCode" 
                name="postalCode" 
                value={shippingAddress.postalCode} 
                onChange={handleAddressChange} 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="city" className="block text-sm font-medium text-gray-700">City *</label>
              <input 
                type="text" 
                id="city" 
                name="city" 
                value={shippingAddress.city} 
                onChange={handleAddressChange} 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="country" className="block text-sm font-medium text-gray-700">Country</label>
            <select 
              id="country" 
              name="country" 
              value={shippingAddress.country} 
              onChange={handleAddressChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
            >
              <option value="NO">Norway</option>
              <option value="DK">Denmark</option>
              <option value="SE">Sweden</option>
              <option value="FI">Finland</option>
            </select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email *</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                value={shippingAddress.email} 
                onChange={handleAddressChange} 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
              <input 
                type="tel" 
                id="phone" 
                name="phone" 
                value={shippingAddress.phone} 
                onChange={handleAddressChange} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
              />
            </div>
          </div>
        </div>
        
        <div className="mb-8">
          <h3 className="text-xl font-medium mb-4 text-gray-700">Shipping Method</h3>
          
          <div className="space-y-4">
            {shippingOptions.map(option => (
              <div 
                key={option.id} 
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedShipping === option 
                    ? 'border-orange-500 bg-orange-50' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => handleShippingSelection(option)}
              >
                <div className="flex flex-col md:flex-row justify-between">
                  <div className="mb-2 md:mb-0">
                    <h4 className="font-medium text-gray-800">{option.title}</h4>
                    <p className="text-gray-600 text-sm">{option.description}</p>
                    <p className="text-gray-500 text-sm mt-1">{option.eta}</p>
                  </div>
                  <div className="font-medium text-gray-800">
                    {option.amount.value / 100} {option.amount.currency}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-end mt-8">
          <button 
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            onClick={proceedToPayment}
            disabled={loading}
          >
            Continue to Payment
          </button>
        </div>
      </div>
    );
  };

  // Render the appropriate step
  const renderStep = () => {
    switch (step) {
      case 'shipping':
        return renderShipping();
      case 'payment':
        return renderPayment();
      case 'confirmation':
        return renderConfirmation();
      default:
        return renderShipping();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-sans">
      {renderStep()}
    </div>
  );
};

export default VippsMobilePayCheckout;
