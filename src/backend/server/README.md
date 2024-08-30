Backend part of PMC-Vis Implementation

The program can built using maven:
  1. mvn dependency:copy-dependencies
  2. mvn package

The server can be started by using the script /bin/run
  ./bin/run server PrismDefault.yml
will start the with default setting. "server" here is the keyword
necessary to start the server (other keywords can be implemented to
use the codebase for other purposes).
"PrismDefault.yml" is a configuration file needed for the server to get basic information.

The source-code can be found in /src/main/java/prism, and is split
into the following packages:

/src/main/java/prism/server: contains the main function to start
the server, as well utility function interacting with the
dropwizard server architecture.

/src/main/java/prism/resources: contains the resources the server
uses in order to interact with the frontend over http/https

/src/main/java/prism/core: contains the core functionality of the
PMC-Vis backend, including the wrapper for the Model Checker, as
well as formalisation of most functions over the model

/src/main/java/prism/database: contains all database
funtionalities, including the database warpper as well as
some Mapper classes translating database result into java Objects

/src/main/java/prism/api: contains the data-objects that are
send to the frontend (via a json-wrapper transforming these
objects into json).

/src/main/java/prism/cli: contains other main functions that can be
used in order to achive some of the PMC-Vis functionality without
needing to start the server.

/src/main/java/prism/misc: Contains utility classes and functions
that do not fit into any of the other packages.
