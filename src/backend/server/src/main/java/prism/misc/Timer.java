package prism.misc;

import java.time.LocalTime;

public class Timer implements AutoCloseable {

//    String name;
    TimeSaver timeSaver;


    public Timer(TimeSaver timeSaver){
//        this.name = name;
        this.timeSaver = timeSaver;
        timeSaver.storeStartTime(LocalTime.now());
    }

    @Override
    public void close() {
        timeSaver.storeEndTime(LocalTime.now());
    }
}
