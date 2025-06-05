// Simple script to test login functionality
const fetch = require('node-fetch');

async function testLogin() {
  try {
    // Test login with admin credentials
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'Arthur',
        password: 'password123'
      }),
      credentials: 'include'
    });
    
    if (!loginResponse.ok) {
      console.error('Login failed:', await loginResponse.text());
      return;
    }
    
    console.log('Login successful!');
    const userData = await loginResponse.json();
    console.log('User data:', userData);
    
    // Now check if we're properly authenticated
    const userCheckResponse = await fetch('http://localhost:5000/api/user', {
      credentials: 'include'
    });
    
    if (!userCheckResponse.ok) {
      console.error('Authentication check failed:', await userCheckResponse.text());
      return;
    }
    
    const authCheckData = await userCheckResponse.json();
    console.log('Authentication check successful!');
    console.log('Current user info:', authCheckData);
  } catch (error) {
    console.error('Error during login test:', error);
  }
}

testLogin();