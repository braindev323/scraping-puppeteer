## Node Setup on Ubuntu Server
   1. sudo apt-get install curl
   2. curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
   3. sudo apt-get install nodejs

   check node version

   node -v

## Project Run
    1. Go to project directory and npm install
        cd /home/xsiox/scriping
        npm install
    2. Forever Install Globally
        npm install -g forever

    2. Puppeteer Install
        PUPPETEER_PRODUCT=firefox npm i puppeteer

    3. Start & Stop Server
        #start server forever
            npm run start_server
        #stop sever forever
            npm run stop_server
        #start server for test
            node index.js
        #stop test server
            CTRL + c

    4. Force stop server
        sudo kill -9 $(pgrep -f "node|firefox")
        
    5. Check node server status
        sudo ps aux | grep -E "node|firefox"