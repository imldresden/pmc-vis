package prism.cli;

import io.dropwizard.Configuration;
import io.dropwizard.cli.ConfiguredCommand;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.jdbi3.JdbiFactory;
import io.dropwizard.setup.Bootstrap;
import io.dropwizard.setup.Environment;
import net.sourceforge.argparse4j.inf.Namespace;
import net.sourceforge.argparse4j.inf.Subparser;
import org.jdbi.v3.core.Jdbi;
import prism.core.Model;
import prism.db.Database;
import prism.server.PRISMServerConfiguration;

import java.io.*;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Objects;

public class SchedulerConverter extends ConfiguredCommand<PRISMServerConfiguration> {

    public SchedulerConverter() {
        // The name of our command is "hello" and the description printed is
        // "Prints a greeting"
        super("scheduler", "Prints the scheduler for a project");
    }

    @Override
    public void configure(Subparser subparser) {
        super.configure(subparser);

        subparser.addArgument("-m", "--model")
                .dest("model")
                .type(String.class)
                .required(true)
                .help("The model the scheduler should run on");

        subparser.addArgument("-p", "--properties")
                .dest("properties")
                .type(String.class)
                .required(true)
                .help("The property file for the scheduler");

        subparser.addArgument("-o", "--out")
                .dest("out")
                .type(String.class)
                .required(true)
                .help("output directory");
    }


    @Override
    protected void run(Bootstrap bootstrap, Namespace namespace, PRISMServerConfiguration configuration) throws Exception {
        final JdbiFactory factory = new JdbiFactory();
        DataSourceFactory dbfactory = configuration.getDataSourceFactory();
        String projectID = "temp";
        String rootDir = configuration.getPathTemplate();

        try{
            Files.createDirectory(Paths.get(String.format("%s/%s", rootDir, projectID)));
        }catch(FileAlreadyExistsException e){
            System.out.println("temp was not deleted");
            removeDir(new File(String.format("%s/%s", rootDir, projectID)));
            Files.createDirectory(Paths.get(String.format("%s/%s", rootDir, projectID)));
        }

        dbfactory.setUrl(String.format("jdbc:sqlite:%s/%s/%s", configuration.getPathTemplate(), projectID, prism.core.Namespace.DATABASE_FILE));
        //copy model
        copyFile(new File((String) namespace.get("model")), new File(String.format("%s/%s/%s", rootDir, projectID, prism.core.Namespace.PROJECT_MODEL)));
        //copy properties
        copyFile(new File((String) namespace.get("properties")), new File(String.format("%s/%s/%s", rootDir, projectID, "properties.props")));

        final Jdbi jdbi = factory.build(new Environment("temp"), dbfactory, projectID);
        Database database = new Database(jdbi, configuration.getDebug());

        Model model = new Model(projectID, configuration.getPathTemplate(),  database, configuration.getCUDDMaxMem(), configuration.getIterations(), configuration.getDebug());
        model.printScheduler(namespace.get("out"));
        model.removeFiles();
    }

    private void copyFile(File inFile, File outFile){
        try (
                InputStream in = new BufferedInputStream(
                        new FileInputStream(inFile));
                OutputStream out = new BufferedOutputStream(
                        new FileOutputStream(outFile))) {

            byte[] buffer = new byte[1024];
            int lengthRead;
            while ((lengthRead = in.read(buffer)) > 0) {
                out.write(buffer, 0, lengthRead);
                out.flush();
            }
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private void removeDir(File dir) throws Exception {
        if (dir.exists()) {
            for (File file : Objects.requireNonNull(dir.listFiles())) {
                file.delete();
            }
            dir.delete();
        }
    }
}
