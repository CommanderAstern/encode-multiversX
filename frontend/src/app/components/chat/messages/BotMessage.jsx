import React, { useState, useEffect } from 'react';
import Highlight from 'react-highlight';
import axios from 'axios';
import Image from 'next/image';

import Button from './Button';
import ContractForm from '../forms/ContractForm';
import useWalletProvider from '@/hooks/useWalletProvider';
import { useChatStore } from '@/store/store';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

import {
  ApiNetworkProvider
} from "@multiversx/sdk-network-providers";

import {
  Address,
  SmartContract,
  CodeMetadata,
  TransactionWatcher,
  ResultsParser,
  Code,
  Transaction,
  TokenTransfer
} from "@multiversx/sdk-core";


const BotMessage = ({ message }) => {
  const walletProvider = useWalletProvider();
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [messageSegments, setMessageSegments] = useState([]);
  const [erc20Address, setErc20Address] = useState('');
  const supabase = createClientComponentClient();
  const [wasmLink, setWasmLink] = useState('');
  const {
    selectedChatId,
  } = useChatStore((state) => state.selectedChatId);
  const apiNetworkProvider = new ApiNetworkProvider("https://devnet-api.multiversx.com");

  // Extracts the transaction details from the given message.
  const extractTransactionDetails = () => {
    // Regular expression to match transaction details like $start$address|amount$end$
    const parsed = message.match(/\$start\$(.*?)\|(.*?)\$end\$/);
    if (parsed && parsed.length === 3) {
      return { address: parsed[1], amount: parsed[2] };
    }
    return null;
  };

  // Extracts the wasm link from the given message.
  const extractWasmLink = () => {
    // Regular expression to match wasm links like #wasmstart#https://example.com/mycontract.wasm#wasmend#
    const match = message.match(/#wasmstart#(.*?)#wasmend#/);
    if (match) {
      return match[1].trim();
    }
    return '';
  };

  // Parses and highlights the code from the given message. Also, extracts the ERC20 address.
  const extractAndHighlightCode = () => {
    const segments = [];
    let remainingMsg = message;

    const extractAndHighlight = (pattern) => {
      const match = remainingMsg.match(pattern);
      if (match) {
        const codeStart = match.index;
        const codeEnd = codeStart + match[0].length;
        const codeContent = match[1];
        if (codeStart > 0) {
          segments.push(remainingMsg.substring(0, codeStart));
        }
        // Convert the matched content to a JSX element with syntax highlighting 
        // and add it to the 'segments' array
        segments.push(<Highlight className="language-rust m-2 rounded-lg" key={segments.length}>{codeContent}</Highlight>);
        remainingMsg = remainingMsg.substring(codeEnd);
      }
    };

    while (remainingMsg) {
      if (remainingMsg.includes('```')) {
        // Extract the code between the first set of triple backticks and highlight it.
        extractAndHighlight(/```(.*?)```/s);
      } else {
        // Replace transaction details, WASM links, and ERC20 address markers with their content 
        // (or remove them if not needed for display).
        remainingMsg = remainingMsg.replace(/\$start\$(.*?)\|(.*?)\$end\$/, '') // Replace transaction details markers with their content.
          .replace(/#wasmstart#(.*?)#wasmend#/, '$1') // Replace WASM link markers with their content.
          .replace(/#erc20start#(.*?)#erc20end#/, ''); // Remove ERC20 address markers since they've been processed.

        // Parse markdown links (e.g., [Google](http://google.com)) in the remaining message.
        segments.push(...parseMarkdownLinks(remainingMsg));
        remainingMsg = '';
      }
    }
    return segments;
  };

  const parseMarkdownLinks = (input) => {
    // Regular expression to match markdown links like [text](url)
    const regex = /\[([^\]]+)\]\(([^\)]+)\)/g;
    let jsxOutput = [];
    let lastIndex = 0;
    // Iterate through each markdown link match in the input
    let match;
    while ((match = regex.exec(input)) !== null) {
      const beforeText = input.slice(lastIndex, match.index);
      // If there's text before the markdown link, add it to the output array
      if (beforeText) {
        jsxOutput.push(beforeText);
      }
      // Convert the markdown link match to an <a> JSX element and add to the output array
      jsxOutput.push(<a href={match[2]} key={match.index} target="_blank" rel="noopener noreferrer" className='text-blue-900'>{match[1]}</a>);
      lastIndex = match.index + match[0].length;
    }
    const afterText = input.slice(lastIndex);
    if (afterText) {
      jsxOutput.push(afterText);
    }
    return jsxOutput;
  }


  const parseErc20Address = (input) => {
    let _erc20Address = '';
    const match = input.match(/#erc20start#(.*?)#erc20end#/)
    if (match) {
      _erc20Address = match[1].trim();
    }
    setErc20Address(_erc20Address);
  }

  // Runs all the parsing logic
  useEffect(() => {
    parseErc20Address(message);
    setTransactionDetails(extractTransactionDetails());
    setWasmLink(extractWasmLink());
    setMessageSegments(extractAndHighlightCode());
  }, [message]);

  const deployContract = async () => {
    try {
      // Get deployer's address and details on the network
      const deployerAddress = await walletProvider.login();
      const deployerOnNetwork = await apiNetworkProvider.getAccount(Address.fromBech32(deployerAddress));

      // Fetch the contract's WASM code
      const response = await axios.get(`${window.location.origin}/api?wasmUrl=${wasmLink}`);
      const buffer = Buffer.from(response.data.buffer);
      const code = Code.fromBuffer(buffer);

      // Prepare the deploy transaction
      const contract = new SmartContract();
      const deployTransaction = contract.deploy({
        deployer: Address.fromBech32(deployerAddress),
        code: code,
        codeMetadata: new CodeMetadata(),
        initArguments: [],
        gasLimit: 20000000,
        chainID: "D"
      });
      deployTransaction.setNonce(deployerOnNetwork.nonce);

      // Sign and send the transaction
      const signedDeployTransaction = await walletProvider.signTransaction(deployTransaction);
      await apiNetworkProvider.sendTransaction(signedDeployTransaction);
      const transactionOnNetwork = await new TransactionWatcher(apiNetworkProvider).awaitCompleted(signedDeployTransaction);

      // Determine the address of the deployed contract
      const contractAddress = SmartContract.computeAddress(deployTransaction.getSender(), deployTransaction.getNonce());

      // Handle the transaction's outcome
      const { returnCode } = new ResultsParser().parseUntypedOutcome(transactionOnNetwork);
      const baseExplorerLink = "https://devnet-explorer.multiversx.com";
      let message;
      if (returnCode.isSuccess()) {
        console.log("Contract deployed successfully");
        message = `Your contract has been deployed successfully! Check it out [here](${baseExplorerLink}/accounts/${contractAddress})`;
      } else {
        console.log("Contract deployment failed");
        message = `Your contract deployment failed. Check out the [transaction](${baseExplorerLink}/transactions/${transactionOnNetwork.hash}) on the explorer.`;
      }
      const { error } = await supabase.from('messages').insert([{
        text: message,
        conversation_id: selectedChatId,
        is_bot: true
      }]);

      if (error) throw error;

    } catch (error) {
      console.error(error);
    }
  };

  const handleTransactionClick = async () => {
    try {
      // Logging the transaction initiation.
      console.log(`Sending ${transactionDetails.amount} eGold to ${transactionDetails.address}`);
      // Authenticate with the wallet provider to get the deployer's address.
      const deployerAddress = await walletProvider.login();
      const deployerOnNetwork = await apiNetworkProvider.getAccount(Address.fromBech32(deployerAddress));

      // Construct the transaction details.
      const tx = new Transaction({
        gasLimit: 700000,
        sender: Address.fromBech32(deployerAddress),
        receiver: Address.fromBech32(transactionDetails.address),
        value: TokenTransfer.egldFromAmount(transactionDetails.amount),
        chainID: "D"
      });

      // Set the nonce for the transaction and sign it.
      tx.setNonce(deployerOnNetwork.nonce);
      const signedTx = await walletProvider.signTransaction(tx);

      // Send the transaction and obtain the hash.
      const txHash = await apiNetworkProvider.sendTransaction(signedTx);

      // Construct the link for the explorer and notify the user.
      const explorerLink = `https://devnet-explorer.multiversx.com/transactions/${txHash}`;
      const messageData = {
        text: `Your tansaction has been sent successfully! Check it out [here](${explorerLink})`,
        conversation_id: selectedChatId,
        is_bot: true
      };
      // Insert the message into the database.
      const { error } = await supabase.from('messages').insert([messageData]);
      if (error) throw error;
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className='flex justify-start w-full relative mb-6 max-w-3xl'>
      <div className='flex bg-light-cream rounded-2xl p-5'>
        <div className='flex flex-shrink-0 m-2 rounded-full overflow-hidden'>
          <Image src="/icons/avatar-1.svg" alt="User Profile" width={50} height={50} />
        </div>
        <div className='flex flex-col text-gray-700 ml-1 flex-grow overflow-hidden'>
          {messageSegments.map((segment, index) => (
            <React.Fragment key={index}>{segment}</React.Fragment>
          ))}
          {transactionDetails && (
            <Button onClick={handleTransactionClick} label="Execute Transaction" />
          )}
          {wasmLink && (<Button onClick={deployContract} label="Deploy Contract" />)}
          {erc20Address && <ContractForm contractAddress={erc20Address} />}
        </div>
      </div>
      <span className='w-10 h-10 rounded-br-full bg-light-cream absolute bottom-0 left-0 transform translate-y-1/2'></span>
    </div>
  )
}

export default BotMessage;
