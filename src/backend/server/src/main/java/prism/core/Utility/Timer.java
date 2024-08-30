package prism.core.Utility;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.time.Duration;
import java.time.LocalTime;

public class Timer implements AutoCloseable {

    String name;
    File output;
    LocalTime start;


    public Timer(String name, File output){
        this.name = name;
        this.output = output;
        start = LocalTime.now();
    }

    @Override
    public void close() throws Exception {
        LocalTime stop = LocalTime.now();
        long duration = Duration.between(start, stop).toMillis();
        try(BufferedWriter write = new BufferedWriter(new FileWriter(output, true))){
            write.write(String.format("%s: %s ms\n", name, duration));
        }
    }
}
