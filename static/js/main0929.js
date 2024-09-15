async function getFunctionSignature(hash) {
    const url = `https://raw.githubusercontent.com/ethereum-lists/4bytes/master/signatures/${hash}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Signature not found');
    }
    const functionSignature = await response.text();
    return functionSignature;
}

async function getTransaction(rpcProviderUrl, txHash) {
    const response = await fetch(rpcProviderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionByHash',
            params: [txHash],
            id: 1
        })
    });
    const transactionResponse = await response.json();
    return transactionResponse;
}

function generatePythonCode(functionName, parametersInDefinition, toAddress, parametersInAbi, parametersInFunctionCall, value) {
    return `
def ${functionName}(${parametersInDefinition}):
    contract_address = '${toAddress}'
    to_address = web3.to_checksum_address(contract_address)
    abi = [{
      "constant": False,
      "inputs": [${parametersInAbi}],
      "name": "${functionName}",
      "outputs": [],
      "payable": ${value > 0 ? 'True' : 'False'},
      "stateMutability": "${value > 0 ? 'payable' : 'nonpayable'}",
      "type": "function"
    }]
    contract = web3.eth.contract(address=to_address, abi=abi)
    return contract.functions.${functionName}(${parametersInFunctionCall})
`;
}


function updateHTMLContent(elementId, content) {
    document.getElementById(elementId).textContent = content;
}

async function decodeTransaction() {
    console.log('Decoding transaction...');
    try {
        updateHTMLContent('decodeButton', '解码中...');
        document.getElementById('decodeButton').disabled = true;

        // 清空解码结果区域
        updateHTMLContent('decodedTransaction', '');
        updateHTMLContent('output', '');

        const rpcProviderUrl = document.getElementById('rpcProvider').value;
        const txHash = document.getElementById('txHash').value;

        // 检查txHash是否有效
        if (!/^0x([A-Fa-f0-9]{64})$/.test(txHash)) {
            showAlert('无效的交易哈希', 'danger');
            return;
        }

        // 将hash添加到URL末尾
        if (txHash && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
            window.history.pushState({}, '', `./${txHash}`);
        }

        console.log('💪 尝试获取交易详情...');

        const transactionResponse = await getTransaction(rpcProviderUrl, txHash);

        const fromAddress = transactionResponse.result.from;
        const toAddress = transactionResponse.result.to;
        const value = parseInt(transactionResponse.result.value, 16) / 1e18;
        const gas = parseInt(transactionResponse.result.gas, 16).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const gasPrice = parseInt(transactionResponse.result.gasPrice, 16) / 1e9;
        const inputData = transactionResponse.result.input;

        const functionSignatureHash = inputData.slice(2, 10);

        console.log('💪 尝试获取函数签名...');

        let functionSignature = await getFunctionSignature(functionSignatureHash);

        functionSignature = `function ${functionSignature.replace(/\s/g, '')} returns ()`; // Add "function" keyword and empty returns

        const functionName = functionSignature.slice('function '.length, functionSignature.indexOf('('));

        let functionFragment = ethers.utils.Fragment.fromString(functionSignature);
        let parameterTypes = functionFragment.inputs.map(input => input.type);

        console.log("🌟 Signature result: \nfunctionName: " + functionName + "\nparameterTypes: " + parameterTypes);

        let parametersInDefinition = '';
        let parametersInAbi = '';
        let parametersInFunctionCall = '';

        // Ensure parameterTypes is an array before processing
        if (Array.isArray(parameterTypes) && parameterTypes.length > 0) {
            parametersInDefinition = parameterTypes.map((_, index) => `param_${_}_${index + 1}`).join(',');
            parametersInAbi = parameterTypes.map((type, index) => `{"name": "param_${type}_${index + 1}", "type": "${type}"}`).join(',');
            parametersInFunctionCall = parameterTypes.map((_, index) => `param_${_}_${index + 1}`).join(',');
        }

        const pythonCode = generatePythonCode(functionName, parametersInDefinition, toAddress, parametersInAbi, parametersInFunctionCall, value);

        console.log("✅ python code generated");

        console.log('💪 尝试解码参数...');

        try {
            const abiCoder = new ethers.utils.AbiCoder();
            let params = null;

            if (Array.isArray(parameterTypes)) {
                console.log("Input data: ", '0x' + inputData.slice(10));
                params = abiCoder.decode(parameterTypes, '0x' + inputData.slice(10));
                console.log("Decoded params: ", params);
            }

            let functionCallParams = '';
            let functionParamsObj = [];
            if (params) {
                functionCallParams = params.map((param, index) => {
                    if (Array.isArray(param)) {
                        param = '[]';
                    } else if (ethers.BigNumber.isBigNumber(param)) {
                        param = param.toString();
                    }
                    const key = parameterTypes[index];
                    functionParamsObj.push({ [key]: param });
                    return parameterTypes[index] === 'string' || parameterTypes[index] === 'address' ? `'${param}'` : param;
                }).join(', ');
            }

            const functionParamsObjStr = JSON.stringify(functionParamsObj, null, 2);

            const pythonFunctionCall = `
func = ${functionName}(${functionCallParams})
`;

            // Decoding successful, remove the d-none class
            $('#decodedTransactionContainer').removeClass('d-none');
            $('#generatedCodeContainer').removeClass('d-none');

            updateHTMLContent('output', pythonCode + pythonFunctionCall);

            // document.getElementById('decodedTransaction').textContent = "Function Name: " + functionName + "\nFunction Params: " + functionParamsObjStr + "\nFrom Address: " + fromAddress + "\nTo Address: " + toAddress + "\nValue: " + value + "\nGas: " + gas + "\nGasPrice: " + gasPrice + " gWei";

            let decodedTransactionEl = document.getElementById('decodedTransaction');

            let functionParamsHTML = functionParamsObj.map(obj => {
                const key = Object.keys(obj)[0];
                const value = obj[key];
                return `<li><strong>${key}:</strong> ${value}</li>`;
            }).join('');

            decodedTransactionEl.innerHTML = `
    <p><strong>Function Signature Hash:</strong> 0x${functionSignatureHash}</p>
    <p><strong>Function Name:</strong> ${functionName}</p>
    <p><strong>Function Params:</strong></p>
    <ul>${functionParamsHTML}</ul>
    <p><strong>From Address:</strong> ${fromAddress}</p>
    <p><strong>To Address:</strong> ${toAddress}</p>
    <p><strong>Value:</strong> ${value}</p>
    <p><strong>Gas:</strong> ${gas}</p>
    <p><strong>GasPrice:</strong> ${gasPrice} gWei</p>
`;

            const codeBlocks = document.querySelectorAll('pre code');
            if (codeBlocks) {
                codeBlocks.forEach((block) => {
                    hljs.highlightElement(block);
                });
            }
            showAlert('交易解码成功', 'success');
        } catch (error) {
            console.log("😭 failed to decode the params via ethers");
            console.log("Failed parameterTypes: ", parameterTypes);
            console.log("Failed data: ", inputData.slice(10));
            showAlert('解码失败: ' + error.message, 'danger');
            return; // Exit function after error
        }

        updateHTMLContent('decodeButton', '解码交易');
        document.getElementById('decodeButton').disabled = false;
    } catch (error) {
        console.error('解码过程中出错:', error);
        showAlert('解码失败: ' + error.message, 'danger');
    } finally {
        document.getElementById('decodeButton').disabled = false;
        updateHTMLContent('decodeButton', '解码交易');
    }
}

function getHashFromUrlAndDecode() {
    const url = window.location.href;
    const txHash = url.split('/').pop();

    if (txHash.startsWith('0x')) {
        document.getElementById('txHash').value = txHash;
        decodeTransaction();
    }
}

function showAlert(message, type) {
    const alertContainer = document.getElementById('alert-container');
    if (alertContainer) {
        const alertElement = document.createElement('div');
        alertElement.className = `alert alert-${type} alert-dismissible fade show`;
        alertElement.role = 'alert';
        alertElement.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        alertContainer.appendChild(alertElement);
        
        setTimeout(() => {
            alertElement.remove();
        }, 5000);
    } else {
        console.error('Alert container not found');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('myForm');
    const decodeButton = document.getElementById('decodeButton');

    if (form) {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            decodeTransaction();
        });
    } else {
        console.error('Form not found');
    }

    if (decodeButton) {
        decodeButton.addEventListener('click', function(event) {
            event.preventDefault();
            decodeTransaction();
        });
    } else {
        console.error('Decode button not found');
    }

    getHashFromUrlAndDecode();
});
