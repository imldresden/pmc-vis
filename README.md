## **PMC-VIS:** Interactive Visualization meets Probabilistic Model Checking
----------------------------

### Requirements
1. Active Docker Daemon (min 2GB RAM, recommended 4+GB RAM)
2. A chromium-based browser (e.g., Google Chrome)

----------------------------

#### Docker Compose:
1. on the directory `./src`
2. `docker compose up` starts the server: 
   - `-d` flag detaches the running system
   - `--build` flag rebuilds docker images
   - `docker compose down` stops the system
   - `docker image prune` removes dangling images
3. web vis at `http://localhost:3000` 
   - example projects on  `./data`

----------------------------

#### Local installation:
Requirements: GNU make, gcc, JDK 11, git, NodeJS v. 16+
  1. backend:
      - new terminal, go to `src/backend/`
        - install prism:
        - download prism: `git clone https://github.com/prismmodelchecker/prism`
        - go to `src/backend/prism/prism`
        - run `git checkout 03c6c15`
        - build prism: `make`
      - go to `src/backend/server/`
        - download dependencies: `mvn dependency:copy-dependencies`
        - build server: `mvn package` 
        - start server: `./bin/run server PRISMDefault.yml` 
        - debug mode: `./bin/run server PRISMDebug.yml`
  2. frontend:
      - new terminal, go to `src/frontend/`
        - build server: `npm install` 
        - start server: `npm start`
      - web vis at `http://localhost:3000`
        - backend server at `localhost:8080` 

----------------------------

## Research: 

PMC-VIS: An Interactive Visualization Tool for Probabilistic Model Checking <a href="https://doi.org/10.1007/978-3-031-47115-5_20">(DOI link)</a>

More information on <a href="https://imld.de/pmc-vis">imld.de/pmc-vis</a>

