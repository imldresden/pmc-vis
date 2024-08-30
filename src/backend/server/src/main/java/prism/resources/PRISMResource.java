package prism.resources;

import com.codahale.metrics.annotation.Timed;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.jdbi3.JdbiFactory;
import io.dropwizard.setup.Environment;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import org.glassfish.jersey.media.multipart.FormDataContentDisposition;
import org.glassfish.jersey.media.multipart.FormDataParam;
import org.jdbi.v3.core.Jdbi;
import prism.api.Graph;
import prism.api.Message;
import prism.core.Model;
import prism.core.Namespace;
import prism.core.cluster.ClusterType;
import prism.db.Database;
import prism.server.PRISMServerConfiguration;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;


/**
 * Main Resource of the Application (TODO: Splitting this up might be more easily readable)
 */
@Path("/{project_id}")
@Produces(MediaType.APPLICATION_JSON)
public class PRISMResource {

    private final Environment environment;
    private final PRISMServerConfiguration configuration;

    private final String rootDir;
    private String cuddMaxMem;

    private int maxIterations;
    private final boolean debug;

    private Map<String, Model> currModels;


    public PRISMResource(Environment environment, PRISMServerConfiguration configuration){
        this.environment = environment;
        this.configuration = configuration;
        this.rootDir = configuration.getPathTemplate();
        this.debug = configuration.getDebug();
        this.cuddMaxMem = configuration.getCUDDMaxMem();
        this.maxIterations = configuration.getIterations();
        this.currModels = new HashMap<>();

        final JdbiFactory factory = new JdbiFactory();
        DataSourceFactory dbfactory = configuration.getDataSourceFactory();

        File[] files = Objects.requireNonNull(new File(rootDir).listFiles());
        Arrays.sort(files);
        for (File file : files) {
            if (file.isDirectory()){
                try {
                    String projectID = file.getName();
                    createStyleFile(projectID);
                    dbfactory.setUrl(String.format("jdbc:sqlite:%s/%s", file.getPath(), Namespace.DATABASE_FILE));

                    final Jdbi jdbi = factory.build(environment, dbfactory, projectID);
                    Database database = new Database(jdbi, debug);
                    currModels.put(projectID, new Model(projectID, rootDir,  database, cuddMaxMem, maxIterations, debug));
                } catch (Exception e) {
                    System.out.println(e);
                    continue;
                }

            }
        }
    }

    private static Response ok(Graph g){
        return Response.ok(g).build();
    }

    private static Response ok(Message m) {
        return Response.ok(m).build();
    }

    private static Response missing(Message m){
        return Response.status(Response.Status.NOT_FOUND).entity(m).build();
    }

    private static Response error(Object o){
        System.out.println(o);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(o).build();
    }

    private static Response abstractionMissing(long abstractionID){
        return missing(new Message(String.format("AbstractionID %s has not been found", abstractionID)));
    }

    @GET
    @Timed
    @Operation(summary = "Returns entire graph")
    public Response createUpperGraph(
            @Parameter(description = "identifier of project")
            @PathParam("project_id") String projectID,
            @QueryParam("cluster") List<Integer> abstractionID,
            @QueryParam("scheduler") Optional<Integer> schedulerID
    ) {
        try{
            if (!currModels.containsKey(projectID)) return error(new Message(String.format("Project %s not found", projectID)));
            return ok(currModels.get(projectID).getGraph(schedulerID.orElse(-1), abstractionID));
        } catch (Exception e) {
            return error(e);
        }
    }

    @Path("/create-project")
    @POST
    @Timed
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Operation(summary = "Upload Files to Model Checker", description = "POST Model Files in Order to create a new Project. POST property files in order to add properties to compute")
    public Response uploadProject(
            @Parameter(description = "identifier of project")
            @PathParam("project_id") String projectID,
            @Parameter(description = "Model File to upload to project")
            @FormDataParam("model_file") InputStream modelInputStream,
            @FormDataParam("model_file") FormDataContentDisposition modelDetail,
            @Parameter(description = "Property File to upload to project")
            @FormDataParam("property_file") InputStream propInputStream,
            @FormDataParam("property_file") FormDataContentDisposition propDetail
            ) {

        String output = "";

        if(modelDetail != null) {
            if (new File(String.format("%s/%s", rootDir, projectID)).exists()){
                return Response.status(Response.Status.FORBIDDEN).entity("project already exists").build();
            }
            try {
                Files.createDirectory(Paths.get(String.format("%s/%s", rootDir, projectID)));
                createStyleFile(projectID);
                final String uploadModel = String.format("%s/%s/", rootDir, projectID) + Namespace.PROJECT_MODEL;
                writeToFile(modelInputStream, uploadModel);
                output += String.format("Model File uploaded to %s\n", uploadModel);
            } catch (IOException e) {
                return error(e);
            }
        }

        if (propDetail != null){
            final String uploadProp = String.format("%s/%s/", rootDir, projectID) + propDetail.getFileName();
            try {
                writeToFile(propInputStream, uploadProp);
            } catch (IOException e) {
                return error(e);
            }
            output += String.format("Property File uploaded to %s\n", uploadProp);
        } else if (modelDetail != null) {
            output += "Property File empty";
        }

        try {
            final JdbiFactory factory = new JdbiFactory();
            DataSourceFactory dbfactory = configuration.getDataSourceFactory();
            dbfactory.setUrl(String.format("jdbc:sqlite:%s/%s/%s", rootDir, projectID, Namespace.DATABASE_FILE));

            final Jdbi jdbi = factory.build(environment, dbfactory, projectID);
            Database database = new Database(jdbi, debug);
            currModels.put(projectID, new Model(projectID, rootDir,  database, cuddMaxMem, maxIterations, debug));
        } catch (Exception e) {
            return error(e);
        }

        return Response.ok(output).build();
    }

    @Path("/remove-project:{project_id}")
    @GET
    @Timed
    @Operation(summary = "removes an existing project", description = "Removes all Modelfiles and Database Entries regarding the Project in question from the backend")
    public Response removeProject(
            @Parameter(description = "identifier of project")
            @PathParam("project_id") String projectID
    ){
        try {
        currModels.get(projectID).removeFiles();
        currModels.remove(projectID);

        } catch (Exception e) {
            if(debug){
                e.printStackTrace(System.out);
            }
            return error(e);
        }
        return ok(new Message(String.format("Project %s has been removed", projectID)));
    }

    @Path("/node:{id}")
    @GET
    @Timed(name="node")
    @Operation(summary = "Returns single node", description = "Returns single Node Object with identifier 'id'")
    public Response getNode(
            @Parameter(description = "identifier of project")
            @PathParam("project_id") String projectID,
            @Parameter(description = "Identifier of target node", required = true)
            @PathParam("id") long nodeID
    ) {
        return ok(this.currModels.get(projectID).getState(nodeID));

    }

    @Path("/outgoing")
    @GET
    @Timed(name="outgoing")
    @Operation(summary = "Returns all outgoing edges", description = "Returns all edges starting in state 'id'")
    public Response getOutgoing(
            @Parameter(description = "identifier of project")
            @PathParam("project_id") String projectID,
            @Parameter(description = "Identifier of target node", required = true) @QueryParam("id") List<Long> nodeIDs,
            @Parameter(description = "Identifier of scheduler used. Marks the transitions the scheduler would take") @QueryParam("scheduler") Optional<Integer> schedulerID,
            @QueryParam("cluster") List<Integer> clusterID
    ) {
        if (!currModels.containsKey(projectID)) return error(String.format("project %s not open", projectID));
        return ok(currModels.get(projectID).getOutgoing(nodeIDs, schedulerID.orElse(-1), clusterID));
    }

    @Path("/initial")
    @GET
    @Timed(name="initial")
    @Operation(summary = "Returns all initial nodes", description = "Returns all nodes that are marked as initial states")
    public Response getInitial(
            @Parameter(description = "identifier of project")
            @PathParam("project_id") String projectID,
            @QueryParam("cluster") List<Integer> clusterID
    ) {
        return ok(currModels.get(projectID).getInitialNodes(clusterID));
    }

    @Path("/cluster:{type}")
    @GET
    @Operation(summary = "Creates a cluster", description = "")
    public Response createScheduler(
            @Parameter(description = "identifier of project")
            @PathParam("project_id") String projectID,
            @PathParam("type") ClusterType type,
            @QueryParam("target") Optional<String> target,
            @QueryParam("granularity") Optional<Long> granularity
    ) {
        try {
            List<String> parameters = new ArrayList<>();
            if (target.isPresent()){
                parameters.add(target.get());
                if (granularity.isPresent()){
                    parameters.add(granularity.get().toString());
                }else{
                    parameters.add("1");
                }
            }

            return ok(new Message(currModels.get(projectID).createCluster(type, parameters)));
        } catch (Exception e) {
            return error(e);
        }
    }

    // save uploaded file to new location
    private void writeToFile(InputStream uploadedInputStream, String uploadedFileLocation) throws IOException {
        int read;
        final int BUFFER_LENGTH = 1024;
        final byte[] buffer = new byte[BUFFER_LENGTH];
        OutputStream out = new FileOutputStream(uploadedFileLocation);
        while ((read = uploadedInputStream.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        out.flush();
        out.close();
    }

    private void createStyleFile(String projectID) throws IOException {
        File style = new File(String.format("%s/%s/", rootDir, projectID) + Namespace.STYLE_FILE);
        if (style.createNewFile()){
            try(FileWriter w = new FileWriter(style)){
                w.write(Namespace.DEFAULT_STYLE);
            }
        }
    }
}
