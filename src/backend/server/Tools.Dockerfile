FROM movesrwth/stormpy:1.11.0

#Create working dir
RUN useradd -ms /bin/bash prismServer

#Load dependencies

ENV DEBIAN_FRONTEND=noninteractive
RUN apt update && apt install -y gcc-11 build-essential cmake openjdk-11-jdk git bc zsh maven curl ca-certificates libboost-program-options-dev rustup postgresql && rm -rf /var/lib/apt/lists/*
RUN install -d /usr/share/postgresql-common/pgdg
#RUN curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
#RUN . /etc/os-release
#RUN sh -c "echo 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt questing-pgdg main' > /etc/apt/sources.list.d/pgdg.list"
#RUN apt update && apt install -y postgresql-14 && rm -rf /var/lib/apt/lists/*

ENV PATH="$PATH:/usr/lib/postgresql/17/bin"

RUN rustup default stable

#build prism

WORKDIR /home/prismServer

RUN git clone https://github.com/prismmodelchecker/prism prism

#build prism
WORKDIR /home/prismServer/prism/prism

RUN git checkout 17a47f8

WORKDIR /home/prismServer/prism/prism

RUN make

# Load Switts-Multi
WORKDIR /home/prismServer

COPY switss switss
WORKDIR /home/prismServer/switss/build

RUN cmake ..
RUN make

RUN cp switss-multi /usr/local/bin/

WORKDIR /home/prismServer

#build SVaBResp
COPY SVaBResp SVaBResp
WORKDIR /home/prismServer/SVaBResp

#To lock to a certain commit
#RUN git checkout c541affb994f3ed044ae4e1dce3ed3dd078323be
RUN cargo build --release --package svabresp-cli --bin svabresp-cli

#Load the SPR Tool
#COPY spr-storm spr-storm
WORKDIR /home/prismServer
#Load PMC-Vis backend (dependencies first)
COPY server/pom.xml server/pom.xml
WORKDIR /home/prismServer/server
RUN mvn dependency:copy-dependencies


#Load everything into the image
WORKDIR /home/prismServer
COPY server/ server/

WORKDIR /home/prismServer/server

#Package Server
RUN mvn package

#Make executable
RUN chown -R prismServer . && chown -R prismServer /var/run/postgresql && chown -R prismServer /opt #&& chown -R prismServer /home/prismServer/spr-storm

RUN sed -i 's/\r$//' bin/run && chmod +x bin/run && chmod +x bin/initdb

# Init db as prismServer
USER prismServer

RUN /bin/bash -c 'bin/initdb'

#Hook gurobi license
VOLUME ["/data"]
ENV GRB_LICENSE_FILE="/data/gurobi.lic"

ENTRYPOINT ["bin/run", "server", "DockerTools.yml"]

EXPOSE 8080
EXPOSE 8082
