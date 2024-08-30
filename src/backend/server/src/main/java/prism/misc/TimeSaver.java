package prism.misc;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

public class TimeSaver {

    private List<LocalTime> startTimes = new ArrayList<>();

    private List<LocalTime> endTimes = new ArrayList<>();

    private File outputFile;

    private String modelId;

    private String viewName;

    private String testName;

    public TimeSaver(String testName, String modelId, String viewName, File outputFile) {
        this.testName = testName;
        this.outputFile = outputFile;
        this.modelId = modelId;
        this.viewName = viewName;
    }

    public TimeSaver(File outputFile) {
        this.outputFile = outputFile;
    }

    public void storeStartTime(LocalTime startTime) {
        this.startTimes.add(startTime);
    }

    public void storeEndTime(LocalTime endTime) {
        this.endTimes.add(endTime);
    }


    public List<LocalTime> getStartTimes() {
        return startTimes;
    }

    public List<LocalTime> getEndTimes() {
        return endTimes;
    }

    public LocalTime getStartTime(int i) {
        return startTimes.get(i);
    }

    public LocalTime getEndTime(int i) {
        return endTimes.get(i);
    }

    public long getDurationInMsAt(int i) {
        return Duration.between(startTimes.get(i), endTimes.get(i)).toMillis();
    }

    public List<Long> getDurationsInMs() {
        long amountSamples;
        if (startTimes.size() != endTimes.size()) {
            throw new RuntimeException("startTimes.size() != endTimes.size()");
        } else {
            amountSamples = startTimes.size();
        }
        List<Long> durations = new ArrayList<>();
        for (int i = 0; i < amountSamples; i++) {
            durations.add(getDurationInMsAt(i));
        }
        return durations;
    }

    public double getAvgDurationInMs() {
        long amountSamples;
        if (startTimes.size() != endTimes.size()) {
            throw new RuntimeException("startTimes.size() != endTimes.size()");
        } else {
            amountSamples = startTimes.size();
        }
        long durationAccLong = 0;
        for (int i = 0; i < amountSamples; i++) {
            durationAccLong += getDurationInMsAt(i);
        }
        return ((double)durationAccLong) / amountSamples;
    }

    public double getAvgDurationInMs(int j) {
        long amountSamples;
        if (startTimes.size() != endTimes.size()) {
            throw new RuntimeException("startTimes.size() != endTimes.size()");
        } else {
            amountSamples = startTimes.size();
        }
        long durationAccLong = 0;
        for (int i = j; i < amountSamples; i++) {
            durationAccLong += getDurationInMsAt(i);
        }
        return ((double)durationAccLong) / amountSamples;
    }

    public double getVariance() {
        double avgDur = getAvgDurationInMs();
        return getDurationsInMs()
                .stream()
                .mapToDouble(Long::doubleValue)
                .map(dur -> (dur - avgDur) * (dur - avgDur))
                .sum() / (startTimes.size() - 1);
    }
    public double getVarianceSinFirst() {
        double avgDur = getAvgDurationInMs();
        List<Long> durations = getDurationsInMs();
        durations.remove(0);
        return durations
                .stream()
                .mapToDouble(Long::doubleValue)
                .map(dur -> (dur - avgDur) * (dur - avgDur))
                .sum() / (durations.size() - 1);
    }

    public Duration getDurationAt(int i) {
        return Duration.between(startTimes.get(0), endTimes.get(0));
    }

    public void writeAvgDurationToFile() throws Exception {
        try(BufferedWriter write = new BufferedWriter(new FileWriter(outputFile, true))){
            write.write(String.format("ModelId: %s, View: %s, %s\n", modelId, viewName, testName));
            write.write(String.format("AvgDuration: %s ms\n", getAvgDurationInMs()));
            write.write(String.format("DurationsArray: %s\n\n", getDurationsInMs()));
        }
    }

    public void writeTotalTestDurationToFile() throws Exception {
        try(BufferedWriter write = new BufferedWriter(new FileWriter(outputFile, true))){
            Duration dur = getDurationAt(0);
            long hours = dur.toHours();
            dur = dur.minusHours(hours);
            long minutes = dur.toMinutes();
            dur = dur.minusMinutes(minutes);
            long seconds = dur.getSeconds();
            write.write(String.format("Total Test Duration: %s:%s:%s\n", hours, minutes, seconds));
        }
    }

    public void add(TimeSaver ts) {
        startTimes.addAll(ts.startTimes);
        endTimes.addAll(ts.endTimes);
    }

    public void clear() {
        startTimes = new ArrayList<>();
        endTimes = new ArrayList<>();
    }
}
