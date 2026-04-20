package prism.core.Computation;

import prism.core.Model;
import prism.core.Namespace;
import prism.core.Property.Property;

import java.io.*;
import java.math.BigInteger;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public class WitnessTask extends DataProviderTask {

    private final String binaryLocation; // Location of switss-multi
    private final int gurobiTimelimit; // Specifies the Gurobi timelimit in seconds
    private final String subsystemFilename;

    public WitnessTask(String name, int id, Model model, String property, String propertyExpression, Map<String, String> arguments) {

        super(name, id, model, property, propertyExpression, arguments, true, false);
        this.binaryLocation = "../switss/build/switss-multi";
        this.gurobiTimelimit = Integer.parseInt(arguments.get("timeout"))/1000;
        this.subsystemFilename = "ws_0.txt";
    }

    @Override
    public void callTool() {
        String modelPath = String.format("%s/%s", model.parent.getPath(), model.getModelFile().getName());

        Map<String, String> results = callSwitssMulti(modelPath, propertyExpression);
        Map<String, String> modifiedResults = new HashMap<>();
        for (Map.Entry<String, String> entry : results.entrySet()) {
            modifiedResults.put(mapStateToId(entry.getKey().replace("{", "(")), entry.getValue());
        }
        this.writeToDatabase(model.getTableStates(), this.getColumnName(), Namespace.ENTRY_S_ID, modifiedResults);
        this.writeToDatabase(model.getTableStates(), this.getHighlightCollumn(), Namespace.ENTRY_S_ID, modifiedResults);
    }

    @Override
    public double getMin(){
        return 0.0;
    }

    @Override
    public double getMax(){
        return 1.0;
    }

    @Override
    public boolean isReady() {
        String property = this.propertyExpression;
        if (property.contains("Pmax=?") || property.contains("Pmin=?")){
            return false;
        }
        try{
            String call = binaryLocation;
            ProcessBuilder builder = new ProcessBuilder(call, "--help");
            Process process = builder.start();

            int exitVal = process.waitFor();
            if (exitVal == 0) {
                return true;
            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            BufferedReader errorReader = new BufferedReader(new InputStreamReader(process.getErrorStream()));
            String line;
            StringBuilder logger = new StringBuilder();
            while ((line = reader.readLine()) != null) {
                logger.append(line).append("\n");
            }
            while ((line = errorReader.readLine()) != null) {
                logger.append(line).append("\n");
            }
            System.out.println(logger);

        } catch (InterruptedException | IOException e) {
            return false;
        }
        return false;
    }

    @Override
    public String shortName(){
        return "witness";
    }

    private Map<String, String> callSwitssMulti(String modelPath, String property) {
        if (property.contains("P>=")) {
            property = property.replace("P>=", "Pmin>=");
        }

        String call = String.format("./%s", binaryLocation);

        // Declare files for communication with switss-multi
        Path propFile = null;
        Path witnessFile = null;
        
        try {
            // Create temporary file containing property
            propFile = Files.createTempFile("property", ".prop");
            Files.writeString(propFile, property);
            ProcessBuilder builder = new ProcessBuilder(call, modelPath, "--prop", propFile.toAbsolutePath().toString(), "--grb-timelimit", Integer.toString(this.gurobiTimelimit), "--witness", "--export-subsystem-states");
            Process process = builder.start();

            int exitVal = process.waitFor();
            if (exitVal != 0) {
                BufferedReader errorReader = new BufferedReader(new InputStreamReader(process.getErrorStream()));
                StringBuilder logger = new StringBuilder();
                String line;
                while ((line = errorReader.readLine()) != null) {
                    logger.append(line).append("\n");
                }
                throw new RuntimeException("Error in SwittsMulti Execution:\n" + logger);
            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            BufferedReader errorReader = new BufferedReader(new InputStreamReader(process.getErrorStream()));
            String line;
            StringBuilder logger = new StringBuilder();
            while ((line = reader.readLine()) != null) {
                logger.append(line).append("\n");
            }
            while ((line = errorReader.readLine()) != null) {
                logger.append(line).append("\n");
            }
            //System.out.println(logger);


            Path subsystemPath = Paths.get(this.subsystemFilename);
            if (Files.exists(subsystemPath)){
                reader = new BufferedReader(new FileReader(this.subsystemFilename));
                StringBuilder content = new StringBuilder();
                Map<String, String> map = new HashMap<>();
                while ((line = reader.readLine()) != null) {  // read line by line
                    content.append(line).append("\n");
                    String valuation = line.replace("[", "(").replace("]", ")").replace("&", ",").replaceAll("\\s+", "").trim();
                    System.out.println(valuation);
                    map.put(valuation, "1");
                }
                return map;
            }
        }
        catch (InterruptedException | IOException e) {
            throw new RuntimeException(e);
        }
        finally {
            if (propFile != null){
                try {
                    Files.deleteIfExists(propFile);
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
        }

        return new HashMap<String, String>();
    }
}

