FROM debian:11-slim

#Create working dir
RUN useradd -ms /bin/bash prismServer

#Load dependencies

ENV DEBIAN_FRONTEND=noninteractive
RUN apt update && apt install -y gcc build-essential cmake default-jdk git bc zsh maven && rm -rf /var/lib/apt/lists/*

#build prism

WORKDIR /home/prismServer

RUN git clone https://github.com/prismmodelchecker/prism prism

WORKDIR /home/prismServer/prism/prism

RUN git checkout 03c6c15

WORKDIR /home/prismServer/prism/prism

RUN make

WORKDIR /home/prismServer

#Load everything into the image
COPY . server/

WORKDIR /home/prismServer/server

RUN mvn dependency:copy-dependencies

RUN mvn package

RUN sed -i 's/\r$//' bin/run && chmod +x bin/run

ENTRYPOINT ["bin/run", "server", "PRISMDefault.yml"]

EXPOSE 8080
