'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function CheckoutPage() {
  interface OrderData {
    totalPrice: number;
    basePrice?: number;
    vestSelected?: boolean;
    vestPrice?: number;
    fabricOption?: { text: string };
  }

  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentToken, setPaymentToken] = useState(null);
  
  // Load order data from localStorage
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('memoryBearOrder');
      if (savedData) {
        setOrderData(JSON.parse(savedData));
      }
    } catch (err) {
      console.error('Error loading order data:', err);
      setError('Could not load your order. Please return to the previous page and try again.');
    }
  }, []);
  
  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Create a simplified payload for testing
      const payload = {
        amount: (orderData?.totalPrice ?? 0) * 100 || 50000, // Convert to øre
        currency: 'DKK',
        reference: `order-${Date.now()}`,
        description: 'Memory Bear Order'
      };
      
      const response = await axios.post('/api/checkout/create', payload);
      
      if (response.data && response.data.token) {
        setPaymentToken(response.data.token);
        alert('Payment initialized successfully! Token: ' + response.data.token);
        // In a real implementation, you would initialize the Vipps SDK here
      } else {
        throw new Error('Invalid response from checkout API');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  if (!orderData) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Checkout</h1>
        <p className="text-red-600">No order data found. Please return to the product page.</p>
      </div>
    );
  }
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Checkout</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
        <div className="border-b border-gray-200 pb-4 mb-4">
          <div className="flex justify-between mb-2">
            <span>Memory Bear - {orderData.fabricOption?.text || 'Custom Bear'}</span>
            <span>{orderData.basePrice || 0} DKK</span>
          </div>
          
          {orderData.vestSelected && (
            <div className="flex justify-between mb-2">
              <span>Memory Bear Vest</span>
              <span>{orderData.vestPrice || 0} DKK</span>
            </div>
          )}
        </div>
        
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{orderData.totalPrice || 0} DKK</span>
        </div>
      </div>
      
      <div className="mt-6">
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition disabled:bg-gray-400"
        >
          {loading ? 'Processing...' : 'Proceed to Payment'}
        </button>
      </div>
      
      {paymentToken && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">
            Payment initialized successfully! In a production environment, the Vipps MobilePay 
            checkout would open here.
          </p>
        </div>
      )}
    </div>
  );
}