// Client-side configuration
'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import React, { useEffect, useState } from 'react';
import Popover from '@mui/material/Popover';
import { useRouter } from 'next/navigation'; // Corrected the import path
import Image from 'next/image';

export default function BasicPopover() {
  // Initialize Supabase client and next router
  const supabase = createClientComponentClient();
  const router = useRouter();

  // State for the Popover component and the user settings form
  const [anchorEl, setAnchorEl] = useState(null);
  const [editingAPIKey, setEditingAPIKey] = useState(false);
  const [openAPIKey, setOpenAPIKey] = useState('');
  const [tempAPIKey, setTempAPIKey] = useState(openAPIKey);

  // Fetch the OpenAI API key and wallet address from local storage on component mount
  useEffect(() => {
    setOpenAPIKey(window?.localStorage?.getItem('openAIKey') || '');
  }, []);

  // Reset the temp states when the popover closes
  useEffect(() => {
    if (anchorEl === null) {
      setEditingAPIKey(false);
      setTempAPIKey(openAPIKey);
    }
  }, [anchorEl]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const startEditingAPIKey = () => {
    setTempAPIKey(openAPIKey);
    setEditingAPIKey(true);
  };

  // Save the OpenAI API key to local storage
  const saveAPIKey = () => {
    setOpenAPIKey(tempAPIKey);
    window?.localStorage?.setItem('openAIKey', tempAPIKey);
    setEditingAPIKey(false);
  };

  // Handle user sign out and navigate to the login page
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  return (
    <div className='ml-4'>
      {/* User avatar icon */}
      <Image src='/icons/avatar-0.svg' alt='User' onClick={handleClick} width={40} height={40} className='rounded-full cursor-pointer' />
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <div className="p-4">
          {/* OpenAI API Key input field */}
          <div className="flex mb-4">
            <label className="block mb-2">OpenAI API Key</label>
            <input
              type="text"
              value={editingAPIKey ? tempAPIKey : openAPIKey}
              onChange={e => setTempAPIKey(e.target.value)}
              className={`border px-2 py-1 w-full ${!editingAPIKey ? 'bg-gray-200 cursor-not-allowed' : ''}`}
              disabled={!editingAPIKey}
            />
            <button
              onClick={editingAPIKey ? saveAPIKey : startEditingAPIKey}
              className="text-white px-4 py-2 rounded-r bg-mindful-gray-80"
            >
              {editingAPIKey ? 'Save' : 'Edit'}
            </button>
          </div>

          {/* Logout button */}
          <button onClick={handleSignOut} className='rounded-lg w-full bg-mindful-gray-80 text-white text-bold p-2'>Logout</button>

        </div>
      </Popover>
    </div>
  );
}
