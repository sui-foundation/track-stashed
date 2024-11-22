import { ZkSendLink, ZkSendLinkBuilder } from '@mysten/zksend';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import fs from 'fs';

// read a line from a file
const file = fs.readFileSync('./getstashed_links.txt', 'utf-8');
const lines = file.split('\n');

// use getFullnodeUrl to define Devnet RPC location
const rpcUrl = getFullnodeUrl('mainnet');
 
// create a client connected to devnet
const client = new SuiClient({ url: rpcUrl });

console.log('loaded', lines.length, 'links');

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

let claimed = []
let oneOrMore = []
let transferredSui = new Map<string, boolean>();
async function execute(lines: string[]) {
  // for line in lines claim the link
  for (let line of lines) {
    if (line.length === 0) {
      continue;
    }
    let link = await ZkSendLink.fromUrl(line, {client});
    if (link.claimedBy) {
      claimed.push(link.claimedBy);
      let txBlocks = await client.queryTransactionBlocks({
        limit: 5,
        filter: {
          FromAddress: link.claimedBy
        },
        options: {
          showBalanceChanges: true
        }
      });
      if (txBlocks.data.length > 0) {
        oneOrMore.push(link.claimedBy);
      }
      txBlocks.data.forEach((tx) => {
        const transferred = tx.balanceChanges?.some((change) => {
          const ownerStr = (change.owner as { AddressOwner: string })?.AddressOwner;

          return ownerStr === link.claimedBy && parseInt(change.amount) < -4_000_000_000;
        });
        if (transferred && link.claimedBy) {
          transferredSui.set(link.claimedBy, true);
        }
      })
      console.log('claimed by address: ', link.claimedBy);
      console.log('txBlocks', txBlocks);
    }
    // sleep for 1 second
    await sleep(1000);
  }
  console.log(claimed.length, ' out of ', lines.length, ' cards have been claimed');
  console.log('out of the cards that have been claimed, ', oneOrMore.length, 'have >= 1 transaction');
  console.log('out of the cards that have been claimed, ', transferredSui.size, 'have sent more than 4 SUI out or in a transaction');
}

await execute(lines)
