package prism.core.Computation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import prism.api.EditorHighlighting;
import prism.api.EditorOption;
import prism.api.EditorParameter;
import prism.core.Model;
import prism.core.Namespace;
import prism.core.Property.Property;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ResponsibilityTask extends DataProviderTask {

    private final static Pattern sVaBRespOutputPattern = Pattern.compile("\\((.*)\\)\\s*:\\s*(\\d+(.\\d+)?)");

    private final String binaryLocation;

    public ResponsibilityTask(String name, int id, Model model, String property, String propertyExpression, Map<String, String> arguments) {
        super(name, id, model, property, propertyExpression, arguments);
        this.binaryLocation = this.arguments.get("executable");
    }

    @Override
    public void callTool() {
        String modelPath = String.format("%s/%s", model.parent.getPath(), model.getModelFile().getName());
        String grouping = this.arguments.containsKey("grouping")?this.arguments.get("grouping").toString():null;

        Map<String, String> results = callSVAResp(modelPath, propertyExpression, grouping);
        Map<String, String> modifiedResults = new HashMap<>();
        for (Map.Entry<String, String> entry : results.entrySet()) {
            modifiedResults.put(mapStateToId(entry.getKey().replace("{", "(")), entry.getValue());
        }
        this.writeToDatabase(model.getTableStates(), this.getColumnName(), Namespace.ENTRY_S_ID, modifiedResults);
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
        try{
            String call = String.format("./%s", binaryLocation);
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
        return "Resp";
    }

    private Map<String, String> callSVAResp(String modelPath, String property, String grouping) {
        try {
            String p = property;

            String call = String.format("./%s", binaryLocation);

            String g = grouping;
            if (g == null) {
                g = "individual";
            }

            ProcessBuilder builder = new ProcessBuilder(call, "-o", "parsable", "-a", "refinement", "-g", g, modelPath, p);

            Process process
                    = builder.start();

            StringBuilder logger = new StringBuilder();
            List<String> output = new ArrayList<>();

            BufferedReader reader
                    = new BufferedReader(new InputStreamReader(
                    process.getInputStream()));

            String line;
            while ((line = reader.readLine()) != null) {
                logger.append(line + "\n");
                output.add(line);
            }

            boolean finished = process.waitFor(Long.getLong(arguments.get("timeout")), TimeUnit.MILLISECONDS);

            if (!finished) {
                throw new RuntimeException("Timeout after " + arguments.get("timeout") + " milliseconds");
            }

            int exitVal = process.exitValue();
            if (exitVal == 0) {
                Map<String, String> map = new HashMap<>();
                if (g.equals("individual")) {
                    for (String l : output) {
                        Matcher m = sVaBRespOutputPattern.matcher(l);
                        if (m.find()) {
                            Map<String, String> key = new HashMap<>();
                            for (String pair : m.group(1).split(",")) {
                                String[] split = pair.split("=");
                                key.put(split[0].trim(), split[1].trim());
                            }
                            map.put(key.toString(), m.group(2));
                            System.out.println(key + ":" + m.group(2));
                        }
                    }
                } else {
                    for (String l : output) {
                        String[] pair = l.split(":");
                        map.put(pair[0].trim(), pair[1].trim());
                    }
                }
                return map;
            } else {
                BufferedReader errorReader = new BufferedReader(new InputStreamReader(process.getErrorStream()));
                while ((line = errorReader.readLine()) != null) {
                    logger.append(line + "\n");
                }
                throw new RuntimeException(String.format("Error in SVaBRsp with code %s: \n %s", exitVal, logger.toString()));
            }
        } catch (InterruptedException | IOException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public List<EditorOption> getEditorOptions() {
        try{
            String call = String.format("./%s", binaryLocation);
            String modelPath = String.format("%s/%s", model.parent.getPath(), model.getModelFile().getName());

            ProcessBuilder builder = new ProcessBuilder(call, "list-grouping-options", modelPath);
            Process process = builder.start();

            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));

            int exitVal = process.waitFor();
            if (exitVal == 0) {
                String line;
                StringBuilder logger = new StringBuilder();
                while ((line = reader.readLine()) != null) {
                    logger.append(line).append("\n");
                }
                ObjectMapper mapper = new ObjectMapper();

                return mapper.readValue(logger.toString(), new TypeReference<List<EditorOption>>(){});
            }

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
            System.out.println(e.getMessage());
            return null;
        }
        return null;
    }

    @Override
    public List<EditorHighlighting> getEditorHighlighting(List<String> arguments){
        try{
            System.out.println(arguments);
            String call = String.format("./%s", binaryLocation);
            String modelPath = String.format("%s/%s", model.parent.getPath(), model.getModelFile().getName());

            int size = arguments.size() + 7;
            String[] args = new String[size];
            args[0] = call;
            args[1] = modelPath;
            args[2] = this.propertyExpression;
            for (int i = 0; i < arguments.size(); i++) {
                args[i+3] = arguments.get(i);
            }
            args[size-4] = "--algorithm";
            args[size-3] = "refinement";
            args[size-2] = "-o";
            args[size-1] = "syntax-highlight-json";

            ProcessBuilder builder = new ProcessBuilder(args);
            System.out.println(builder.command().toString());
            Process process = builder.start();

            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));

            int exitVal = process.waitFor();
            if (exitVal == 0) {
                String line;
                StringBuilder logger = new StringBuilder();
                while ((line = reader.readLine()) != null) {
                    logger.append(line).append("\n");
                }
                ObjectMapper mapper = new ObjectMapper();

                System.out.println(logger);

                return mapper.readValue(logger.toString(), new TypeReference<List<EditorHighlighting>>(){});
            }

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
            System.out.println(e.getMessage());
            return null;
        }
        return null;
    }

}

