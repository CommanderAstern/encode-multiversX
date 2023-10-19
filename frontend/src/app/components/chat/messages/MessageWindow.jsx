import React from 'react'
import UserMessage from './UserMessage'
import BotMessage from './BotMessage'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState, useEffect } from 'react';
import { useChatStore } from '@/store/store';

const MessageWindow = () => {
  const supabase = createClientComponentClient();
  const [messages, setMessages] = useState([]);
  const selectedChatId = useChatStore((state) => state.selectedChatId);

  // Fetch messages from DB
  useEffect(() => {
    async function getMessages() {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('text, is_bot')
          .eq('conversation_id', selectedChatId)
          .order('created_at', { ascending: false });
        if (data === null) {
          setMessages([]);
        } else {
          setMessages(data);
        }
      } catch (error) {
        console.log(error);
      }
    };
    getMessages();
  }, [selectedChatId]);

  // Listen for new messages
  useEffect(() => {
    const channel = supabase
      .channel('realtime posts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, payload => {
        setMessages(prevMessages => {
          // Check if message with this ID already exists and the conversation ID matches
          if (prevMessages.some(msg => msg.id === payload.new.id) && payload.new.conversation_id !== selectedChatId) {
            return prevMessages; // Return the unchanged state
          }
          // Otherwise, append the new message
          return [payload.new, ...prevMessages];
        });
      }).subscribe();

    // Unsubscribe from channel on unmount
    return () => {
      supabase.removeChannel(channel);
    }
  }, [supabase]);

  return (
    <div className='flex flex-col-reverse flex-grow p-10 overflow-y-scroll'>
      {
        (!messages || messages.length === 0) ? (
          <div className="text-center text-gray-500 italic">
            👋 Hey there! How can I assist you today? Just start typing or ask any question to begin our chat.
          </div>
        ) : (
          messages?.map((message, index) => {
            if (message.is_bot) {
              return <BotMessage key={index} message={message.text} />
            } else {
              return <UserMessage key={index} message={message.text} />
            }
          })
        )
      }
    </div>
  )
}

export default MessageWindow
