package prism.server;

import io.dropwizard.Application;
import io.dropwizard.jdbi3.JdbiFactory;
import io.dropwizard.setup.Bootstrap;
import io.dropwizard.setup.Environment;
import io.swagger.v3.jaxrs2.integration.resources.OpenApiResource;
import org.eclipse.jetty.servlets.CrossOriginFilter;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.jdbi.v3.core.Jdbi;
import prism.cli.SchedulerConverter;
import prism.resources.PRISMResource;

import javax.servlet.DispatcherType;
import javax.servlet.FilterRegistration;
import java.util.EnumSet;

public class PRISMServerApplication extends Application<PRISMServerConfiguration> {

	public static void main(String[] args) throws Exception {

		new PRISMServerApplication().run(args);

	}

	@Override
	public String getName() {
		return "pmc-vis-server";
	}

	@Override
	public void initialize(Bootstrap<PRISMServerConfiguration> bootstrap) {
		bootstrap.addCommand(new SchedulerConverter());
	}

	@Override
	public void run(PRISMServerConfiguration configuration,
					Environment environment) throws Exception {

		System.out.println("Starting Backend Server");

		// Enable CORS headers
		final FilterRegistration.Dynamic cors =
				environment.servlets().addFilter("CORS", CrossOriginFilter.class);

		// Configure CORS parameters
		cors.setInitParameter("allowedOrigins", "*");
		cors.setInitParameter("allowedHeaders", "X-Requested-With,Content-Type,Accept,Origin");
		cors.setInitParameter("allowedMethods", "GET,POST");

		// Add URL mapping
		cors.addMappingForUrlPatterns(EnumSet.allOf(DispatcherType.class), true, "/*");

		final PRISMResource resource = new PRISMResource(
				environment, configuration
		);
		environment.jersey().register(MultiPartFeature.class);
		environment.jersey().register(resource);

		environment.jersey().register(new OpenApiResource().configLocation("src/main/documentation/openapi.yaml"));

		System.out.println("Backend Server started");
		System.out.println("Server is listening on port http://localhost:8080");
	}


}
