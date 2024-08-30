# **PMC-VIS:** Interactive Visualization meets Probabilistic Model Checking

## Requirements
1. Active Docker Daemon (min 2GB RAM, recommended 4+GB RAM)
2. A chromium-based browser (e.g., Google Chrome)

----------------------------

## Docker Compose:
1. on the directory `./src`
2. `docker compose up` starts the server: 
   - `-d` flag detaches the running system
   - `--build` flag rebuilds docker images
   - `docker compose down` stops the system
   - `docker image prune` removes dangling images
3. web vis at `http://localhost:3000` 
   - example projects on  `./data`

----------------------------

## Local installation:
Requirements: GNU make, gcc, JDK 11, git, NodeJS v. 16+
  1. backend:
      - new terminal, go to: `src/backend/`
        - run: `git clone https://github.com/prismmodelchecker/prism` to download prism
        - go to: `src/backend/prism/prism`
        - run: `git checkout 03c6c15`
        - run: `make` to build prism
      - go to: `src/backend/server/`
        - run: `mvn dependency:copy-dependencies` to download dependencies
        - run: `mvn package` to build server
        - run: `./bin/run server PRISMDefault.yml` to start server
          - or run: `./bin/run server PRISMDebug.yml` to start sever in debug mode
      - server at `localhost:8080` 
  2. frontend:
      - new terminal, go to: `src/frontend/`
        - run: `npm install` to build server
        - run: `npm start` to start server
      - web vis at `http://localhost:3000`

## Research: 

PMC-VIS: An Interactive Visualization Tool for Probabilistic Model Checking <a href="https://doi.org/10.1007/978-3-031-47115-5_20">(doi:link)</a>

More information on <a href="https://imld.de/pmc-vis">imld.de/pmc-vis</a>

