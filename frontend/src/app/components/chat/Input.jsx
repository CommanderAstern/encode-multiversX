'use client'

import React, { useState } from 'react';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useChatStore } from '@/store/store';

const ChatAvatars = [
	"/icons/avatar-0.svg",
	"/icons/avatar-1.svg",
	"/icons/avatar-2.svg"
];

function Input() {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
	const [inputValue, setInputValue] = useState('');
	const supabase = createClientComponentClient();
	const {
		selectedChatId,
		user,
		conversations,
		setConversations,
		setSelectedChatId,
	} = useChatStore();

	const handleInputChange = (event) => {
		const target = event.target;
		setInputValue(target.value);
		target.style.height = 'auto';
		target.style.height = (target.scrollHeight) + 'px';
	};

	const handleAddNewConversation = async () => {
		try {
			const { data, error } = await supabase
				.from('conversations')
				.insert([
					{ name: `New Conversation ${conversations.length + 1}`, user_id: user.id },
				])
				.select();

			const newConversation = {
				...data[0],
				avatar: ChatAvatars[Math.floor(Math.random() * ChatAvatars.length)],
			};

			setConversations([newConversation, ...conversations]);
			setSelectedChatId(newConversation.id);
			return newConversation.id;
		} catch (error) {
			console.log(error);
		}
	}

	const handleSubmit = async (event) => {
		event.preventDefault();
		setInputValue('');
		let chatIdToSend = selectedChatId;
		try {
			if (!selectedChatId) {
				chatIdToSend = await handleAddNewConversation();
			}

			// Send to DB
			const { error } = await supabase.from('messages').insert([
				{ text: inputValue, conversation_id: chatIdToSend, is_bot: false },
			]);
			if (error) {
				throw error;
			}

			// Send to ML server
			const mlResponse = await fetch(`${baseUrl}/generate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					text: inputValue,
					user_id: user.id,
					chat_id: chatIdToSend,
					openAIKey: window?.localStorage?.getItem('openAIKey'),
				}),
			});

			// Check if the ML server responded with a non-200 status code
			if (!mlResponse.ok) {
				throw new Error(`ML server responded with status ${mlResponse.status}`);
			}
		} catch (err) {
			console.error("Error in handleSubmit:", err.message);
		}
	};

	return (
		<form onSubmit={handleSubmit}>
			<div className="flex align-items-center m-6 rounded-custom bg-mindful-gray-10 relative">
				<textarea
					value={inputValue}
					onChange={handleInputChange}
					placeholder="Send a message"
					className={`flex-grow m-10 outline-none border-none rounded-custom min-h-28 bg-mindful-gray-10 text-lg font-semibold text-slate-600 placeholder-slate-600 resize-none overflow-y-scroll max-h-60`}
					rows={1}
					onKeyDown={(event) => {
						if (event.key === 'Enter' && !event.shiftKey) {
							handleSubmit(event);
						}
					}}
				/>
				<button
					type="submit"
					className={`flex absolute bottom-0 right-4 justify-center items-center bg-leaf-green hover:bg-[#97a754] text-white rounded-full focus:outline-none w-16 h-16 m-6`}
				>
					<Image src='/icons/send.svg' alt='Send' width={35} height={35} />
				</button>
			</div>
		</form>
	)
}

export default Input;
