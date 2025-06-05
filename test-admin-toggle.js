// Test script to verify admin toggle functionality
import axios from 'axios';
// For testing on this Replit instance, use localhost:5000
const baseUrl = 'http://localhost:5000';

// Helper function to log in and get an auth token
async function login(username, password) {
  try {
    console.log(`Attempting to log in as ${username}`);
    const response = await axios.post(`${baseUrl}/api/login`, {
      username,
      password
    });
    
    console.log(`Successfully logged in as ${username}`);
    return response.data;
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    throw error;
  }
}

// Helper function to check user status
async function getUserStatus(token) {
  try {
    const response = await axios.get(`${baseUrl}/api/user`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get user status:', error.response?.data || error.message);
    throw error;
  }
}

// Function to toggle admin status for a user
async function toggleAdminStatus(token, userId, shouldBeAdmin) {
  try {
    console.log(`Attempting to ${shouldBeAdmin ? 'make' : 'remove'} admin status for user ${userId}`);
    const response = await axios.post(
      `${baseUrl}/api/admin/users/${userId}/toggle-admin`,
      { isAdmin: shouldBeAdmin },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    console.log(`Admin status toggled successfully`, response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to toggle admin status:', error.response?.data || error.message);
    throw error;
  }
}

// Main test function
async function testAdminToggle() {
  try {
    // Step 1: Log in as an admin user (update credentials as needed)
    console.log("Step 1: Logging in as an admin user");
    const adminUser = await login(process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_PASSWORD || 'adminpassword');
    console.log("Admin login successful, token received");
    
    // Step 2: Get the admin user's profile to verify admin status
    console.log("Step 2: Getting admin user's profile");
    const adminProfile = await getUserStatus(adminUser.token);
    console.log(`Admin user profile: isAdmin=${adminProfile.isAdmin}`);
    
    if (!adminProfile.isAdmin) {
      console.error("User is not an admin. This test requires an admin user.");
      return;
    }
    
    // Step 3: Get a list of users to find a non-admin user to toggle
    console.log("Step 3: Getting list of users");
    const usersResponse = await axios.get(`${baseUrl}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${adminUser.token}`
      }
    });
    const users = usersResponse.data;
    console.log(`Found ${users.length} users`);
    
    // Find a non-admin user who is not Arthur (skip the superadmin for safety)
    const targetUser = users.find(user => 
      !user.isAdmin && 
      user.username !== 'arthur' &&
      user.id !== adminProfile.id
    );
    
    if (!targetUser) {
      console.error("No suitable non-admin user found to test with");
      return;
    }
    
    console.log(`Selected user for testing: ${targetUser.username} (ID: ${targetUser.id})`);
    
    // Step 4: Toggle the user to admin
    console.log("Step 4: Making the user an admin");
    const makeAdminResult = await toggleAdminStatus(adminUser.token, targetUser.id, true);
    console.log(`Make admin result: ${JSON.stringify(makeAdminResult)}`);
    
    // Step 5: Verify the user is now an admin
    console.log("Step 5: Verifying the user is now an admin");
    const updatedUsersResponse = await axios.get(`${baseUrl}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${adminUser.token}`
      }
    });
    const updatedUsers = updatedUsersResponse.data;
    const updatedTargetUser = updatedUsers.find(user => user.id === targetUser.id);
    
    if (!updatedTargetUser) {
      console.error("Could not find the target user after update");
      return;
    }
    
    console.log(`Updated user status: isAdmin=${updatedTargetUser.isAdmin}`);
    
    if (!updatedTargetUser.isAdmin) {
      console.error("Failed to make the user an admin");
      return;
    }
    
    // Step 6: Toggle the user back to non-admin
    console.log("Step 6: Removing admin status");
    const removeAdminResult = await toggleAdminStatus(adminUser.token, targetUser.id, false);
    console.log(`Remove admin result: ${JSON.stringify(removeAdminResult)}`);
    
    // Step 7: Verify the user is now a non-admin again
    console.log("Step 7: Verifying the user is now a non-admin");
    const finalUsersResponse = await axios.get(`${baseUrl}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${adminUser.token}`
      }
    });
    const finalUsers = finalUsersResponse.data;
    const finalTargetUser = finalUsers.find(user => user.id === targetUser.id);
    
    if (!finalTargetUser) {
      console.error("Could not find the target user after final update");
      return;
    }
    
    console.log(`Final user status: isAdmin=${finalTargetUser.isAdmin}`);
    
    if (finalTargetUser.isAdmin) {
      console.error("Failed to remove admin status");
      return;
    }
    
    console.log("Test completed successfully!");
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Use top-level await in ES modules
await testAdminToggle();