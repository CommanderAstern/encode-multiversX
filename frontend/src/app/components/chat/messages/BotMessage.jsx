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
    const [walletProvider, isConnected, setIsConnected] = useWalletProvider();
    const [transactionDetails, setTransactionDetails] = useState(null);
    const [messageSegments, setMessageSegments] = useState([]);
    const [erc20Address, setErc20Address] = useState('');
    const supabase = createClientComponentClient();
    const [wasmLink, setWasmLink] = useState('');
    const {
        selectedChatId,
    } = useChatStore((state) => state.selectedChatId);
    const apiNetworkProvider = new ApiNetworkProvider("https://devnet-api.multiversx.com");

    // Extract transaction details
    useEffect(() => {
        const parsed = message.match(/\$start\$(.*?)\|(.*?)\$end\$/);
        if (parsed && parsed.length === 3) {
            setTransactionDetails({ address: parsed[1], amount: parsed[2] });
        }
    }, [message]);

    // Extract wasm link
    useEffect(() => {
        let _wasmLink = '';
        const match = message.match(/#wasmstart#(.*?)#wasmend#/);
        if (match) {
            _wasmLink = match[1].trim();
        }
        setWasmLink(_wasmLink);
    }, [message]);

    // Highlight code, parse markdown links and extract erc20 address
    useEffect(() => {
        const segments = [];
        let remainingMsg = message.replace(/\$start\$(.*?)\|(.*?)\$end\$/, ''); // Removing transaction details

        const extractAndHighlight = (pattern) => {
            const match = remainingMsg.match(pattern);
            if (match) {
                const codeStart = match.index;
                const codeEnd = codeStart + match[0].length;
                const codeContent = match[1];

                if (codeStart > 0) {
                    segments.push(remainingMsg.substring(0, codeStart));
                }

                segments.push(<Highlight className="language-rust m-2 rounded-lg" key={segments.length}>{codeContent}</Highlight>);
                remainingMsg = remainingMsg.substring(codeEnd);
            }
        };

        while (remainingMsg) {
            if (remainingMsg.includes('```')) {
                extractAndHighlight(/```(.*?)```/s); // Adjusted the regex to detect triple backticks
            } else {
                parseErc20Address(remainingMsg);
                remainingMsg = remainingMsg.replace(/\$start\$(.*?)\|(.*?)\$end\$/, '$1 $2') // Keeps the content between the tags
                    .replace(/#wasmstart#(.*?)#wasmend#/, '$1')
                    .replace(/#erc20start#(.*?)#erc20end#/, ''); // Keeps the content between the tags
                segments.push(...parseMarkdownLinks(remainingMsg));
                remainingMsg = '';
            }
        }

        setMessageSegments(segments);
    }, [message]);

    const parseMarkdownLinks = (input) => {
        const regex = /\[([^\]]+)\]\(([^\)]+)\)/g;

        let jsxOutput = [];
        let lastIndex = 0;

        let match;
        while ((match = regex.exec(input)) !== null) {
            const beforeText = input.slice(lastIndex, match.index);
            if (beforeText) {
                jsxOutput.push(beforeText);
            }

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

    const deployContract = async () => {
        try {
            const deployerAddress = await walletProvider.login();
            const deployerOnNetwork = await apiNetworkProvider.getAccount(Address.fromBech32(deployerAddress));
            const contract = new SmartContract();

            const response = await axios.get("http://localhost:3000/api?wasmUrl=" + wasmLink);
            const buffer = Buffer.from(response.data.buffer);
            const code = Code.fromBuffer(buffer);

            const deployTransaction = contract.deploy({
                deployer: Address.fromBech32(deployerAddress),
                code: code,
                codeMetadata: new CodeMetadata(),
                initArguments: [],
                gasLimit: 20000000,
                chainID: "D"
            });
            deployTransaction.setNonce(deployerOnNetwork.nonce);

            const _deployTransaction = await walletProvider.signTransaction(deployTransaction);

            await apiNetworkProvider.sendTransaction(_deployTransaction);
            let transactionOnNetwork = await new TransactionWatcher(apiNetworkProvider).awaitCompleted(_deployTransaction);

            let contractAddress = SmartContract.computeAddress(deployTransaction.getSender(), deployTransaction.getNonce());

            const { returnCode } = new ResultsParser().parseUntypedOutcome(transactionOnNetwork);
            console.log("Return code:", returnCode);

            if (returnCode.isSuccess()) {
                console.log("Contract deployed successfully");
                const explorerLink = `https://devnet-explorer.multiversx.com/accounts/${contractAddress}`;
                const { error } = await supabase.from('messages').insert([
                    {
                        text: `Your contract has been deployed successfully! Check it out [here](${explorerLink})`,
                        conversation_id: selectedChatId,
                        is_bot: true
                    }
                ]);
                if (error) {
                    throw error;
                }
            } else {
                console.log("Contract deployment failed");
                const explorerLink = `https://devnet-explorer.multiversx.com/transactions/${transactionOnNetwork.hash}`;
                const { error } = await supabase.from('messages').insert([
                    {
                        text: `Your contract deployment failed. Check out the [transaction](${explorerLink}) on the explorer.`,
                        conversation_id: selectedChatId,
                        is_bot: true
                    }
                ]);
                if (error) {
                    throw error;
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleTransactionClick = async () => {
        console.log(`Sending ${transactionDetails.amount} eGold to ${transactionDetails.address}`);
        try {
            const deployerAddress = await walletProvider.login();
            const deployerOnNetwork = await apiNetworkProvider.getAccount(Address.fromBech32(deployerAddress));
            
            let tx = new Transaction({
                gasLimit: 70000,
                sender: Address.fromBech32(deployerAddress),
                receiver: Address.fromBech32(transactionDetails.address),
                value: TokenTransfer.egldFromAmount(transactionDetails.amount),
                chainID: "D"
            });

            tx.setNonce(deployerOnNetwork.nonce);

            tx = await walletProvider.signTransaction(tx)

            let txHash = await apiNetworkProvider.sendTransaction(tx);
            const explorerLink = `https://devnet-explorer.multiversx.com/transactions/${txHash}`
            const { error } = await supabase.from('messages').insert([
                {
                    text: `Your contract has been executed successfully! Check it out [here](${explorerLink})`,
                    conversation_id: selectedChatId,
                    is_bot: true
                }
            ]);
            if (error) {
                throw error;
            }
        } catch(error) {
            console.error(error)
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
