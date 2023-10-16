import React, { useState, useEffect } from 'react';
import Highlight from 'react-highlight';
import Button from './Button';
import Image from 'next/image';
import { ProxyNetworkProvider, ApiNetworkProvider } from "@multiversx/sdk-network-providers";
import { Address } from '@multiversx/sdk-core';
import axios from 'axios';
import { SmartContract } from "@multiversx/sdk-core";
import { CodeMetadata } from "@multiversx/sdk-core";
import { TransactionWatcher } from "@multiversx/sdk-core";
import { ResultsParser } from "@multiversx/sdk-core";
import { Code } from '@multiversx/sdk-core';
import useWalletProvider from '@/hooks/useWalletProvider';
import { useChatStore } from '@/store/store';

const BotMessage = ({ message }) => {
    const [walletProvider, isConnected, setIsConnected] = useWalletProvider();
    const [transactionDetails, setTransactionDetails] = useState(null);
    const [messageSegments, setMessageSegments] = useState([]);
    const [wasmLink, setWasmLink] = useState('');
    const {
        selectedChatId,
        user,
        setSelectedChatId,
    } = useChatStore();

    useEffect(() => {
        const parsed = message.match(/\$start\$(.*?)\|(.*?)\$end\$/);
        if (parsed && parsed.length === 3) {
            setTransactionDetails({ address: parsed[1], amount: parsed[2] });
        }
    }, [message]);

    useEffect(() => {
        let _wasmLink = '';
        const match = message.match(/#wasmstart#(.*?)#wasmend#/);
        if (match) {
            _wasmLink = match[1].trim();
        }
        setWasmLink(_wasmLink);
    }, [message]);

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
                remainingMsg = remainingMsg.replace(/\$start\$(.*?)\|(.*?)\$end\$/, '$1 $2') // Keeps the content between the tags
                    .replace(/#wasmstart#(.*?)#wasmend#/, '$1'); // Keeps the content between the tags

                segments.push(remainingMsg);
                remainingMsg = '';
            }
        }

        setMessageSegments(segments);
    }, [message]);

    const deployContract = async () => {
        const proxyNetworkProvider = new ProxyNetworkProvider("https://devnet-gateway.multiversx.com");
        const apiNetworkProvider = new ApiNetworkProvider("https://devnet-api.multiversx.com");

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

            console.log("Transaction hash:", transactionOnNetwork);

            const { returnCode } = new ResultsParser().parseUntypedOutcome(transactionOnNetwork);
            console.log("Return code:", returnCode);

            if (returnCode.isSuccess()) {
                console.log("Contract deployed successfully");
                const { error } = await supabase.from('messages').insert([
                    { text: "The contract is deployed successfully at ${transactionOnNetwork}", conversation_id: selectedChatId, is_bot: true },
                ]);
                if (error) {
                    throw error;
                }
            } else {
                console.log("Contract deployment failed");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleTransactionClick = () => {
        console.log(`Sending ${transactionDetails.amount} eGold to ${transactionDetails.address}`);
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
                        <Button onClick={handleTransactionClick} />
                    )}
                    {wasmLink && (<Button onClick={deployContract} label="Deploy Transaction" />)}
                </div>
            </div>
            <span className='w-10 h-10 rounded-br-full bg-light-cream absolute bottom-0 left-0 transform translate-y-1/2'></span>
        </div>
    )
}

export default BotMessage;
