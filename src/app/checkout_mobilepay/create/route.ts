import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // For testing/development purposes, we'll return a mock response
    // In production, this would call your actual Vipps MobilePay API
    
    const data = await req.json();
    
    // Log the received data
    console.log('Checkout request data:', data);
    
    // Generate a mock token
    const mockToken = `test_token_${Date.now()}`;
    
    // Return a mock response
    return NextResponse.json({
      token: mockToken,
      reference: data.reference,
      status: 'SUCCESS'
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error handling checkout request:', error);
    return NextResponse.json(
      { error: 'Failed to process checkout request' },
      { status: 500 }
    );
  }
}