FROM debian:11-slim

#Create working dir
RUN useradd -ms /bin/bash prismServer

#Load dependencies

ENV DEBIAN_FRONTEND=noninteractive
RUN apt update && apt install -y gcc build-essential cmake default-jdk git bc zsh maven curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN install -d /usr/share/postgresql-common/pgdg
RUN curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
RUN . /etc/os-release
RUN sh -c "echo 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bullseye-pgdg main' > /etc/apt/sources.list.d/pgdg.list"
RUN apt update && apt install -y postgresql-14 && rm -rf /var/lib/apt/lists/*

ENV PATH="$PATH:/usr/lib/postgresql/14/bin"

#build prism

WORKDIR /home/prismServer

RUN git clone https://github.com/prismmodelchecker/prism prism

WORKDIR /home/prismServer/prism/prism

RUN git checkout c541affb994f3ed044ae4e1dce3ed3dd078323be

WORKDIR /home/prismServer/prism/prism

RUN make

WORKDIR /home/prismServer

#Load everything into the image
COPY . server/

WORKDIR /home/prismServer/server

RUN mvn dependency:copy-dependencies

RUN mvn package

RUN chown -R prismServer . && chown -R prismServer /var/run/postgresql

RUN sed -i 's/\r$//' bin/run && chmod +x bin/run && chmod +x bin/initdb

USER prismServer

RUN /bin/bash -c 'bin/initdb'

ENTRYPOINT ["bin/run", "server", "DockerDefault.yml"]

EXPOSE 8080
EXPOSE 8082
