'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleSignUp = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="h-screen md:flex">
      <div className="relative overflow-hidden md:flex w-1/2 bg-gradient-to-tr from-mindful-gray-40 to-leaf-green justify-around items-center hidden">
        <div>
          <h1 className="text-white font-bold text-4xl font-sans">MxAI</h1>
          <p className="text-white mt-1">Making web3 simple: seamless blockchain interactions for everyone</p>
        </div>
        <div class="absolute -bottom-32 -left-40 w-80 h-80 border-4 rounded-full border-opacity-30 border-t-8"></div>
        <div class="absolute -bottom-40 -left-20 w-80 h-80 border-4 rounded-full border-opacity-30 border-t-8"></div>
        <div class="absolute -top-40 -right-0 w-80 h-80 border-4 rounded-full border-opacity-30 border-t-8"></div>
        <div class="absolute -top-20 -right-20 w-80 h-80 border-4 rounded-full border-opacity-30 border-t-8"></div>
      </div>
      <div className="flex md:w-1/2 justify-center py-10 items-center bg-white">
        <form className="bg-white" onSubmit={handleSignUp}>
          <h1 className="text-gray-800 font-bold text-2xl mb-1">Welcome!</h1>
          <p className="text-sm font-normal text-gray-600 mb-7">Create your account</p>
          <div className="flex items-center border-2 py-2 px-3 rounded-2xl mb-4">
            <input className="pl-2 outline-none border-none" type="text" name="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex items-center border-2 py-2 px-3 rounded-2xl mb-4">
            <input className="pl-2 outline-none border-none" type="password" name="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex items-center border-2 py-2 px-3 rounded-2xl">
            <input className="pl-2 outline-none border-none" type="password" name="confirmPassword" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {error && <p className="text-red-500 mt-2">{error}</p>}
          <button type="submit" className="block w-full bg-mindful-gray-40 hover:bg-leaf-green mt-4 py-2 rounded-2xl text-white font-semibold mb-2">Sign Up</button>
          Already have an account?<span className="text-sm ml-2 hover:text-blue-500 cursor-pointer" onClick={() => router.push('/login')}>Login</span>
        </form>
      </div>
    </div>
  )
}
