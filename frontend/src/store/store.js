import { create } from "zustand"

// Using the zustand library to create a global store named `useChatStore`.
export const useChatStore = create((set) => ({
  // `user` is a variable that represents the current user. Initially set to `null`.
  user: null,
  setUser: (user) => set({ user }),
  // `selectedChatId` is a variable representing the ID of the currently selected chat. Initially set to `null`.
  selectedChatId: null,
  setSelectedChatId: (selectedChatId) => set({ selectedChatId }),
  // `conversations` is an array representing the list of all chat conversations. Initially an empty array.
  conversations: [],
  setConversations: (conversations) => set({ conversations }),
}))

