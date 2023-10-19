import React, { useState } from 'react';
import useWalletProvider from '@/hooks/useWalletProvider';
import { ApiNetworkProvider } from '@multiversx/sdk-network-providers/out';
import { Address, AddressValue, BigIntValue } from '@multiversx/sdk-core';
import axios from 'axios';
import { SmartContract } from "@multiversx/sdk-core";
import { ResultsParser } from "@multiversx/sdk-core";
import { AbiRegistry } from '@multiversx/sdk-core';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useChatStore } from '@/store/store';

function ContractForm({ contractAddress }) {
  const [method, setMethod] = useState('');
  const [address, setAddress] = useState('');
  const [owner, setOwner] = useState('');
  const [spender, setSpender] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const walletProvider = useWalletProvider()
  const supabase = createClientComponentClient();
  const selectedChatId = useChatStore(state => state.selectedChatId);


  const handleMethodChange = (e) => {
    setMethod(e.target.value);
  };

  // Function to call a contract method based on the selected method
  const callContract = async (methodName, ...args) => {
    console.log(`Called ${methodName} with args:`, args);

    // Constants
    const abiUrl = "https://github.com/CommanderAstern/encode-multiversX/raw/sdk-2/frontend/public/contract/erc20.abi.json";
    const response = await axios.get(`${window.location.origin}/api/abi?abiUrl=${abiUrl}`);
    const abiRegistry = AbiRegistry.create(response.data.data);
    const networkProvider = new ApiNetworkProvider("https://devnet-api.multiversx.com");
    const _contractAddress = Address.fromBech32(contractAddress);
    const existingContract = new SmartContract({ address: _contractAddress, abi: abiRegistry });

    // Function to post a message to the chat
    const postMessage = async (message) => {
      const { error } = await supabase.from('messages').insert([
        {
          text: message,
          conversation_id: selectedChatId,
          is_bot: true
        }
      ]);
    };

    // Function to query a contract method
    const queryContract = async (func, args) => {
      const query = existingContract.createQuery({
        func,
        args
      });
      const getEndpoint = abiRegistry.getEndpoint(func);
      const queryResponse = await networkProvider.queryContract(query);
      const { values } = new ResultsParser().parseQueryResponse(queryResponse, getEndpoint);
      return values
    };

    // Function to send a transaction to a contract method
    const sendTransaction = async (method, args) => {
      const deployerAddress = await walletProvider.login();
      const deployerOnNetwork = await networkProvider.getAccount(Address.fromBech32(deployerAddress));
      let tx = existingContract.methods[method](args)
        .withSender(Address.fromBech32(deployerAddress))
        .withNonce(deployerOnNetwork.nonce)
        .withGasLimit(20000000)
        .withChainID("D")
        .buildTransaction();

      tx = await walletProvider.signTransaction(tx);
      const txHash = await networkProvider.sendTransaction(tx);
      return `https://devnet-explorer.multiversx.com/transactions/${txHash}`;
    };

    // Switch statement to handle the different methods
    switch (methodName) {
      case 'balanceOf':
        const balanceOfValue = await queryContract("balanceOf", [new AddressValue(Address.fromBech32(args[0]))]);
        await postMessage(`The balance of ${args[0]} is ${balanceOfValue[0].valueOf().toFixed(0)}`);
        break;

      case 'allowance':
        const allowanceValue = await queryContract("allowance", [new AddressValue(Address.fromBech32(args[0])), new AddressValue(Address.fromBech32(args[1]))]);
        await postMessage(`The allowance of ${args[1]} is ${allowanceValue[0].valueOf().toFixed(0)}`);
        break;

      case 'transfer':
      case 'approve':
        const explorerLink = await sendTransaction(methodName, args.map(arg => arg instanceof Address ? new AddressValue(Address.fromBech32(arg)) : new BigIntValue(arg)));
        await postMessage(`Your transaction has been deployed successfully! Check it out [here](${explorerLink})`);
        break;
    }
  };

  // Function to handle the form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    switch (method) {
      case 'balanceOf':
        callContract('balanceOf', address);
        break;
      case 'allowance':
        callContract('allowance', owner, spender);
        break;
      case 'transfer':
        callContract('transfer', recipient, amount);
        break;
      case 'approve':
        callContract('approve', spender, amount);
        break;
      default:
        break;
    }
  };

  return (
    <div className="max-w-xl w-full mx-auto mt-4 p-6 rounded-md">
      <div className="mb-4">
        <select
          value={method}
          onChange={handleMethodChange}
          className="block w-full p-2 border rounded-md"
        >
          <option value="">--Select a method--</option>
          <option value="balanceOf">Check Balance</option>
          <option value="allowance">Check Allowance</option>
          <option value="transfer">Transfer Tokens</option>
          <option value="approve">Approve</option>
        </select>
      </div>

      {method === 'balanceOf' && (
        <input
          placeholder='Address to query the balance of'
          value={address}
          onChange={e => setAddress(e.target.value)}
          className="mb-4 w-full p-2 border rounded-md"
        />
      )}

      {method === 'allowance' && (
        <>
          <input
            placeholder='Address that owns the funds'
            value={owner}
            onChange={e => setOwner(e.target.value)}
            className="mb-4 w-full p-2 border rounded-md"
          />
          <input
            placeholder='Address that will spend the funds'
            value={spender}
            onChange={e => setSpender(e.target.value)}
            className="mb-4 w-full p-2 border rounded-md"
          />
        </>
      )}

      {method === 'transfer' && (
        <>
          <input
            placeholder='Recipient address'
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            className="mb-4 w-full p-2 border rounded-md"
          />
          <input
            placeholder='Amount'
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="mb-4 w-full p-2 border rounded-md"
          />
        </>
      )}

      {method === 'approve' && (
        <>
          <input
            placeholder='Spender address'
            value={spender}
            onChange={e => setSpender(e.target.value)}
            className="mb-4 w-full p-2 border rounded-md"
          />
          <input
            placeholder='Amount'
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="mb-4 w-full p-2 border rounded-md"
          />
        </>
      )}

      <button
        onClick={handleSubmit}
        className="w-full bg-leaf-green text-white p-2 rounded-md hover:bg-[#97a754] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Execute
      </button>
    </div>
  );

}

export default ContractForm;
