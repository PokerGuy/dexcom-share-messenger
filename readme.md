# Dexcom Share Messenger Server
This repo will contain instructions on how to create a messaging server. Blog posts will go through the evolution of 
the product and a deployment guide will be provided.

To use this, make sure you have git and node installed.

Install git [here][1]
Install node [here][2]

From the command line, type:

git clone https://github.com/PokerGuy/dexcom-share-messenger.git

cd dexcom-share-messenger

sudo npm install

node app.js (username) (password)


The console will show the current reading and last time that the Dexcom Share was updated.

To daemonize and run:

forever start app.js (username) (password)

forever list

tail -F (log file shown from forever list)

Make sure to stop the process with:

forever stopall

This is the first step that will acquire a Share session ID and continually poll the Share service. The next step will be passing the glucose value and direction to a rules engine and integrating with Twilio to send messages.

[1]: https://git-scm.com/book/en/v2/Getting-Started-Installing-Git "Git"
[2]: https://docs.npmjs.com/getting-started/installing-node "Node"