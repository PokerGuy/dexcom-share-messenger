# Dexcom Share Messenger Server
This repo will contain instructions on how to create a messaging server. Blog posts will go through the evolution of 
the product and a deployment guide will be provided.

To run locally, on a Mac, see below. If you have a PC, get a Mac :)

Open a terminal session and type:  
<pre><code>xcode-select --install</pre></code>  

Install Brew 'cuz you're going to need this...  Again, in the Terminal prompt type:
<pre><code>
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
</pre></code>

Now for NodeJS:
<pre><code>
brew search node
brew install node@6.9.1
</pre></code>

Now let's get a few packages at the global level:
<pre><code>
sudo npm install -g grunt
sudo npm install -g forever
sudo npm install -g mocha
</pre></code>

Let's install MongoDb:
<pre><code>
brew install mongodb
brew services start mongodb
</pre></code>

Now let's download this code and get it going:
<pre><code>
cd ~/
git clone https://github.com/PokerGuy/dexcom-share-messenger.git
cd dexcom-share-messenger
sudo npm install
</pre></code>

Let's modify the .env file, it will require entries like this shown below. From the ~/dexcom-share-messenger directory, type nano .env  
When done, just hit Ctrl + X and save the file...
<pre><code>
DEXCOM_USERNAME=yourDexcomUserName
DEXCOM_PASSWORD=awesomepassword
MONGO_URI=mongodb://localhost/dexcom
PORT=3000
TZ=America/Chicago
ACCOUNT_SID=yourTwilioAccountSid
AUTH_TOKEN=yourTwilioAuthToken
CHILD_NAME=Zoe
TWILIO_NUMBER=+1TwilioNumber
MESSAGE_URL=https://yourdomain.com/api/twiml
RESPONSE_URL=https://yourdomain.com/api/acknowledgement
</pre></code>

Now just forever start app.js

Download the client [here](https://github.com/PokerGuy/dexcom-share-client) once the server is running.

DISCLAIMER:  

All information, thought, and code described here is intended for informational and educational purposes only. 
I currently make no attempt at HIPAA privacy compliance. Use of this code is without warranty or support of any kind. 
Use at your own risk, and do not use the information or code to make medical decisions. 