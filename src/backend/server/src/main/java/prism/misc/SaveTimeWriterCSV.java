package prism.misc;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.time.Duration;

public class SaveTimeWriterCSV {
    File outputFile;

    public SaveTimeWriterCSV(File outputFile) {
        this.outputFile = outputFile;
    }

    public void writeCaption(int modelId, String viewName) throws Exception {
        try(BufferedWriter write = new BufferedWriter(new FileWriter(outputFile, true))) {
            write.write("StateCount, 0AvgG, 1AvgG, 0AvgE, 1AvgE, 0AvgB, 1AvgB, 0VarG, 1VarG, 0VarE, 1VarE, 0VarB, 1VarB\n");
        }
    }

    public void writeValue(String valueName, double value) throws Exception {
        try(BufferedWriter write = new BufferedWriter(new FileWriter(outputFile, true))) {
            write.write(String.format("%s%s\n", valueName, value));
        }
    }

    public void writeValue(String valueName, Object value) throws Exception {
        try(BufferedWriter write = new BufferedWriter(new FileWriter(outputFile, true))) {
            write.write(String.format("%s%s\n", valueName, value));
        }
    }

    public void writeLastValue(String valueName, double value) throws Exception {
        try(BufferedWriter write = new BufferedWriter(new FileWriter(outputFile, true))) {
            write.write(String.format("%s%s\n\n\n", valueName, value));
        }
    }

    public void pureWrite(String s) throws Exception {
        try(BufferedWriter write = new BufferedWriter(new FileWriter(outputFile, true))) {
            write.write(s);
        }
    }
    public void writeLastValue(String valueName, Object value) throws Exception {
        try(BufferedWriter write = new BufferedWriter(new FileWriter(outputFile, true))) {
            write.write(String.format("%s%s\n\n\n", valueName, value));
        }
    }

    public void writeDurationToFile(Duration dur, String outputString) throws Exception {
        try(BufferedWriter write = new BufferedWriter(new FileWriter(outputFile, true))){
            long hours = dur.toHours();
            dur = dur.minusHours(hours);
            long minutes = dur.toMinutes();
            dur = dur.minusMinutes(minutes);
            long seconds = dur.getSeconds();
            write.write(String.format("%s: %s:%s:%s\n", outputString, hours, minutes, seconds));
        }
    }

}
