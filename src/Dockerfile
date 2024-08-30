FROM ubuntu:18.04
WORKDIR /usr/src/pmc-vis
ENV DEBIAN_FRONTEND=noninteractive

### 1. install node 16
RUN apt-get update && \
    apt-get install -y gcc curl gnupg build-essential && \
    curl --silent --location https://deb.nodesource.com/setup_16.x | bash - && \
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    apt-get remove -y --purge cmdtest && \
    apt-get update && \
    apt-get install -y nodejs yarn && \
    apt-get install -y cmake openjdk-11-jdk git bc zsh maven && \
    # remove useless files from the current layer
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /var/lib/apt/lists.d/* && \
    apt-get autoremove && \
    apt-get clean && \
    apt-get autoclean

### 2. install prism
WORKDIR /usr/src/pmc-vis/backend/
RUN git clone https://github.com/prismmodelchecker/prism prism
WORKDIR /usr/src/pmc-vis/backend/prism/prism
RUN git checkout 03c6c15
RUN make

### 3. install backend server
WORKDIR /usr/src/pmc-vis/backend/server
COPY backend/server ./
RUN mvn dependency:copy-dependencies
RUN mvn package
RUN sed -i 's/\r$//' bin/run && chmod +x bin/run

### 4. install frontend server
WORKDIR /usr/src/pmc-vis/frontend/
COPY frontend ./
RUN npm install

### 5 install scripts
WORKDIR /usr/src/pmc-vis/
COPY scripts scripts
RUN chmod +x scripts/*

EXPOSE 3000
EXPOSE 8080
ENTRYPOINT ["scripts/wrapper.sh"]
