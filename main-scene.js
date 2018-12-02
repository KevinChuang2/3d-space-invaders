window.Space_Invaders_Scene = window.classes.Space_Invaders_Scene =
class Space_Invaders_Scene extends Scene_Component
  { constructor( context, control_box )     // The scene begins by requesting the camera, shapes, and materials it will need.
      { super(   context, control_box );    // First, include a secondary Scene that provides movement controls:
        //if( !context.globals.has_controls   ) 
          //context.register_scene_component( new Movement_Controls( context, control_box.parentElement.insertCell() ) ); 

        context.globals.graphics_state.camera_transform = Mat4.look_at( Vec.of( 0,4,10 ), Vec.of( 0,0,0 ), Vec.of( 0,1,0 ) );

        const r = context.width/context.height;
        context.globals.graphics_state.projection_transform = Mat4.perspective( Math.PI/4, r, .1, 1000 );

        this.webgl_manager = context;      // Save off the Webgl_Manager object that created the scene.
        this.scratchpad = document.createElement('canvas');
        this.scratchpad_context = this.scratchpad.getContext('2d');     // A hidden canvas for re-sizing the real canvas to be square.
        this.scratchpad.width   = 256;
        this.scratchpad.height  = 256;
        this.texture = new Texture ( context.gl, "", false, false );        // Initial image source: Blank gif file
        this.texture.image.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

        const shapes = { box:   new Cube(),
                         box_2: new Cube(),
                         axis:  new Axis_Arrows(),
                         laser: new Rounded_Capped_Cylinder(10,10),
                         invader1: new Shape_From_File( "/assets/models/invader1.obj" ),
                         invader2: new Shape_From_File( "/assets/models/invader2.obj" ),
                         invader3: new Shape_From_File( "/assets/models/invader3.obj" ),
                         invader4: new Shape_From_File( "/assets/models/invader4.obj" ),
                         player: new Shape_From_File( "/assets/models/player.obj" ),
                         player_base: new Shape_From_File( "/assets/models/player_base.obj" ),
                         player_turret: new Shape_From_File( "/assets/models/player_turret.obj" ),
                         ground: new Shape_From_File( "/assets/models/ground.obj")
                       }
        this.submit_shapes( context, shapes );

        this.materials =
          { 
            invader1: context.get_instance( Phong_Shader1 ).material( Color.of( 1,.855,.078,1 ), { ambient:0.4} ), //make intermediate models
            invader2: context.get_instance( Phong_Shader1 ).material( Color.of( .224,1,.078,1 ), { ambient:0.4} ),
            invader3: context.get_instance( Phong_Shader1 ).material( Color.of( 1,.078,.686,1 ), { ambient:0.4} ),
            invader4: context.get_instance( Phong_Shader1 ).material( Color.of( .078,1,.855,1 ), { ambient:0.4} ),
            ground: context.get_instance( Phong_Shader1 ).material( Color.of( 0.15, 0.07, 0.01, 1 ), { ambient:0.2, specularity:0} ),
            player_base: context.get_instance( Phong_Shader1 ).material( Color.of( 0.80, 0.80, 0.80, 1 ) ),
            player_turret: context.get_instance( Phong_Shader1 ).material( Color.of( 0.70, 0.70, 0.70, 1 ) ),
            player_base_red: context.get_instance( Phong_Shader1 ).material( Color.of( 1,0,0, 1 ) ),
            player_turret_red: context.get_instance( Phong_Shader1 ).material( Color.of( 1,0,0, 1 ) ),
            laser: context.get_instance( Phong_Shader ).material( Color.of( 1, 0, 0, 1 ), { ambient:1, specularity:0, diffusivity:0 }),

            invader1_shadow: context.get_instance( Shadow_Shader ).material(), //make intermediate models
            invader2_shadow: context.get_instance( Shadow_Shader ).material(),
            invader3_shadow: context.get_instance( Shadow_Shader ).material(),
            invader4_shadow: context.get_instance( Shadow_Shader ).material(),
            ground_shadow: context.get_instance( Shadow_Shader ).material(),
            player_base_shadow: context.get_instance( Shadow_Shader ).material(),
            player_turret_shadow: context.get_instance( Shadow_Shader ).material(),
            laser_shadow: context.get_instance(Shadow_Shader).material()
         
          }
        //lightzzz
        this.lights = [ new Light( Vec.of( 0,5,1,0 ), Color.of( 0,1,1,1 ), 100000) ];
        this.enemy_pos = [ ];
        this.laser_pos = [ ];
        this.camera_angle = 0;
        this.target_angle = 0;
        //how many seconds in between each spawn 
        this.spawnRate = 2.0;
        this.spawnTime = 0;
        //angle in which we spawn new enemy 
        this.spawnAngle = 0;
        this.score = 0;
        this.maxSpawn = 15;
        this.health =3;
        this.spawnDistance = 20;
        this.spawnHeight = 10;
        this.fallRate = .025;
        this.enemySpeed = 0.02;
        this.turnLeft = false;
        this.turnRight=false;
        this.gameOver = true;
        this.gameStart = false;
        this.tookDamage=false;
        this.sound = {};
        this.init_sounds(); 
        this.context = context;

      }
    make_control_panel()
      { 
        this.key_triggered_button( "Rotate Left",  [ "a" ], () => this.turnLeft = true, undefined , ()=>this.turnLeft=false );
        this.key_triggered_button( "Rotate Right",  [ "d" ], () => this.turnRight=true, undefined, ()=>this.turnRight=false );
        this.key_triggered_button( "Shoot Laser",  [ "v" ], () => this.shoot_laser() );
        this.key_triggered_button( "Restart (when dead)", ["p"], () => this.restart_game());
      }
    display( graphics_state )
      { graphics_state.lights = this.lights;        // Use the lights stored in this.lights.
        const t = graphics_state.animation_time / 1000, dt = graphics_state.animation_delta_time / 1000;
        if(!this.gameOver)
        {
          if(this.turnLeft)
            this.target_angle+=0.055;
          if(this.turnRight)
            this.target_angle-=0.055;
        }
        
        this.smooth_camera();

        //draw scene from lights perspective
        graphics_state.camera_transform = Mat4.look_at( this.lights[0].position, Vec.of( 0,0,0 ), Vec.of( 0,1,0 ) ); 

        //player
        let model_transform = Mat4.identity().times( Mat4.translation( [0, 2, 0] ) );
        this.shapes.player_base.draw( graphics_state, model_transform, this.materials.player_base_shadow );
        let turret = model_transform.times( Mat4.translation( [0, 1.2, 0] ) )
                                    .times( Mat4.scale( [0.55,0.55,0.55] ) )
                                    .times( Mat4.rotation( this.camera_angle, Vec.of(0,1,0) ) );
        this.shapes.player_turret.draw( graphics_state, turret, this.materials.player_turret_shadow );
        
        //ground
        model_transform = Mat4.identity().times( Mat4.scale( [25, 20, 25] ) )
                                         .times( Mat4.translation([0,0.03,0]) );
        this.shapes.ground.draw( graphics_state, model_transform, this.materials.ground_shadow );

        //enemies
        for (let i=0; i<this.enemy_pos.length; i++) {
            model_transform = Mat4.identity().times( Mat4.rotation( this.enemy_pos[i][1], Vec.of(0,1,0) ) )
                                             .times( Mat4.translation( [this.enemy_pos[i][0],this.enemy_pos[i][2],0] ) )
                                             .times( Mat4.rotation( -Math.PI/2, [0,1,0] ))
                                             .times( Mat4.scale( [0.7,0.7,0.7] ) );
            let rand_index = this.enemy_pos[i][3];
            if (rand_index == 1) { this.shapes.invader1.draw( graphics_state, model_transform, this.materials.invader1_shadow ); } 
            else if (rand_index == 2) { this.shapes.invader2.draw( graphics_state, model_transform, this.materials.invader2_shadow ); } 
            else if (rand_index == 3) { this.shapes.invader3.draw( graphics_state, model_transform, this.materials.invader3_shadow ); } 
            else { this.shapes.invader4.draw( graphics_state, model_transform, this.materials.invader4_shadow ); }
        }

        //lasers
        for (let i=0; i<this.laser_pos.length; i++){
            model_transform = Mat4.identity().times( Mat4.rotation( this.laser_pos[i][1], Vec.of(0,1,0) ) )
                                             .times( Mat4.translation( [this.laser_pos[i][0],3.4,0] ) )
                                             .times( Mat4.rotation( Math.PI/2, Vec.of(0,1,0) ) )
                                             .times( Mat4.scale( [0.05, 0.05, 1] ) );                               
            this.shapes.laser.draw( graphics_state, model_transform, this.materials.laser_shadow );
        }

        this.scratchpad_context.drawImage( this.webgl_manager.canvas, 0, 0, 256, 256 );
        this.texture.image.src = this.scratchpad.toDataURL("image/png");
        this.webgl_manager.gl.clear( this.webgl_manager.gl.COLOR_BUFFER_BIT | this.webgl_manager.gl.DEPTH_BUFFER_BIT);

        // ------------------------------------------------------------------------------------------------------------
        //draw scene from camera perspective

        //update camera position
        turret = turret.times( Mat4.translation([0, 15, 20]) )
                       .times( Mat4.rotation( -0.5, Vec.of(1,0,0) ) );                                         
        graphics_state.camera_transform = Mat4.inverse( turret );

        //player
        model_transform = Mat4.identity().times( Mat4.translation( [0, 2, 0] ) );
        if(!this.tookDamage)
          {
            this.shapes.player_base.draw( graphics_state, model_transform, this.materials.player_base.override( { texture: this.texture } ) );
          }
        else
          {
            this.shapes.player_base.draw( graphics_state, model_transform, this.materials.player_base_red.override( { texture: this.texture } ) );
          }
        turret = model_transform.times( Mat4.translation( [0, 1.2, 0] ) )
                                .times( Mat4.scale( [0.55,0.55,0.55] ) )
                                .times( Mat4.rotation( this.camera_angle, Vec.of(0,1,0) ) );
        if(!this.tookDamage)
          {
            this.shapes.player_turret.draw( graphics_state, turret, this.materials.player_turret.override( { texture: this.texture } ) );
          }
        else
          {
            this.shapes.player_turret.draw( graphics_state, turret, this.materials.player_turret_red.override( { texture: this.texture } ) );
            this.tookDamage=false;
          }
        

        //ground
        model_transform = Mat4.identity().times( Mat4.scale( [25, 20, 25] ) )
                                         .times( Mat4.translation([0,0.03,0]) );
        this.shapes.ground.draw( graphics_state, model_transform, this.materials.ground );

        //enemies
        for (let i=0; i<this.enemy_pos.length; i++){
            model_transform = Mat4.identity().times( Mat4.rotation( this.enemy_pos[i][1], Vec.of(0,1,0) ) )
                                             .times( Mat4.translation( [this.enemy_pos[i][0],this.enemy_pos[i][2],0] ) )
                                             .times( Mat4.rotation( -Math.PI/2, [0,1,0] ))
                                             .times( Mat4.scale( [0.7,0.7,0.7] ) );
            let rand_index = this.enemy_pos[i][3];
            if (rand_index == 1) { this.shapes.invader1.draw( graphics_state, model_transform, this.materials.invader1.override( { texture: this.texture } ) ); } 
            else if (rand_index == 2) { this.shapes.invader2.draw( graphics_state, model_transform, this.materials.invader2.override( { texture: this.texture } ) ); } 
            else if (rand_index == 3) { this.shapes.invader3.draw( graphics_state, model_transform, this.materials.invader3.override( { texture: this.texture } ) ); } 
            else { this.shapes.invader4.draw( graphics_state, model_transform, this.materials.invader4.override( { texture: this.texture } ) ); }
        }

        //lasers
        for (let i=0; i<this.laser_pos.length; i++){
            model_transform = Mat4.identity().times( Mat4.rotation( this.laser_pos[i][1], Vec.of(0,1,0) ) )
                                             .times( Mat4.translation( [this.laser_pos[i][0],3.4,0] ) )
                                             .times( Mat4.rotation( Math.PI/2, Vec.of(0,1,0) ) )
                                             .times( Mat4.scale( [0.05, 0.05, 1] ) );
            this.shapes.laser.draw( graphics_state, model_transform, this.materials.laser.override({texture:this.texture}) );
        }
        if(!this.gameOver)
        {
            this.update_enemy_pos(graphics_state);
            this.update_laser_pos();
            this.spawn_enemies(dt);
        }
        this.displayUI();
      }
      //AUXILIARY FUNCTIONS
      displayUI()
      {
            var score = document.getElementById("score");
            score.innerHTML = this.score;
            var gameOver = document.getElementById("gameover");
            var health = document.getElementById("health");
            health.style.color = "#FF0000";
            health.innerHTML = "♥ ".repeat(this.health);
            if(this.gameOver)
            {
                  
                  gameOver.innerHTML = "Game Over. Press (p) to restart";
            }
            else
            {
                  gameOver.innerHTML = "";
            }

      }
      init_sounds(){
        this.sound.laser = new Audio('assets/sound/151025__bubaproducer__laser-shot-small-1.wav');
        this.sound.laser.load();
        this.sound.laser.playbackRate = 2.5;
        this.sound.hit = new Audio('assets/sound/170149__timgormly__8-bit-hurt.wav');
        this.sound.hit.load();
        this.sound.damage = new Audio('assets/sound/punch_or_whack_-Vladimir-403040765.wav');
        this.sound.damage.currentTime = .2;
        this.sound.damage.load();
      }
      smooth_camera()
      {
          this.camera_angle = this.camera_angle + (this.target_angle - this.camera_angle) * .2;
      }
      update_laser_pos( ){
          for (let i=0; i<this.laser_pos.length; i++){
              const radius = this.laser_pos[i][0];
              const angle = this.laser_pos[i][1];
              
              //check collision here
              if(radius > 20){
                  //remove laser
                  this.laser_pos.splice(i,1);
                  i--;
              } else{
                  this.laser_pos[i][0] += 0.08; //change this to be based on score
                  var result = this.check_laser_hit(radius, angle);
                  if(result){
                     this.laser_pos.splice(i,1);
                     i--; 
                  }
              }
              
          }
      }
      check_laser_hit( radius, angle ){
            const real_pos = [radius*Math.sin(angle), radius*Math.cos(angle)];
            var collision = false;
            for (let j=0; j<this.enemy_pos.length && !collision; j++){
                const r = this.enemy_pos[j][0];
                const a = this.enemy_pos[j][1];
                const rp = [r*Math.sin(a), r*Math.cos(a)];
                const dist = (rp[0]-real_pos[0])**2+(rp[1]-real_pos[1])**2;
                if(dist<2.7){
                    //collision
                    const newAudio = this.sound.hit.cloneNode()
                    newAudio.play();

                    //remove laser and enemy
                    collision = true;
                    this.enemy_pos.splice(j,1);
                    this.score +=10;
                    return true;
                }
            }
            return false;
      }
      update_enemy_pos( graphics_state ){
          for (let i=0; i<this.enemy_pos.length; i++){
              if(this.enemy_pos[i][2]>3)
              {
                    this.enemy_pos[i][2]-=this.fallRate;
              }
              //check collision here
              else if(this.enemy_pos[i][0] < 2.0)
              {
                  
                  this.player_got_hit(graphics_state);
                  
                  //dont move
                  this.enemy_pos.splice(i,1);
                  i--;
              } 
              else
              {
                  this.enemy_pos[i][0] -= this.enemySpeed;
              }
              
          }
      }
      player_got_hit(graphics_state)
      {
        const newAudio = this.sound.damage.cloneNode()
        newAudio.play();
        this.health--;
        if(this.health <=0)
           this.gameOver=true;
        this.tookDamage=true;

      }
      spawn_enemies(dt){
           if(this.enemy_pos.length < this.maxSpawn)
           {
               if(this.spawnTime >= this.spawnRate)
               {
                    var angleOffset = Math.random()* 2* Math.PI;
                    this.spawnAngle =angleOffset;
                    let rand_index = Math.ceil(Math.random() * Math.floor(4));
                    var new_pos = [this.spawnDistance, this.spawnAngle, this.spawnHeight, rand_index];
                    this.enemy_pos.push(new_pos);
                    this.spawnTime=0;
               }
               else
               {
                   this.spawnTime+=dt;
               }
                
             
           }
           this.maxSpawn = Math.floor(this.score/30) + 15;
           this.spawnRate = Math.max(0.5, 2.0 - Math.floor(this.score/50)/6 );
      }
      shoot_laser(){
          if(this.sound.laser.paused && !this.gameOver){
              var new_laser = [0.5, this.camera_angle+Math.PI/2];
            this.laser_pos.push(new_laser);
            this.sound.laser.play()
          }
//           const newAudio = this.laser_sound.cloneNode()
//           newAudio.volume = 0.2;
//           newAudio.play();
      }
      restart_game()
      {
            if(this.gameStart)
          {
                if(this.gameOver)
                {
                      this.score = 0;
                      this.health=3;
                      this.gameOver=false;
                      this.enemy_pos = [];
                      this.laser_pos = [];
                }
          }
          else
          {
              var element = document.getElementById("startScreen");
              element. parentNode.removeChild(element);
              this.gameStart = true;
              this.gameOver = false;
          }
            
      }

  }

class Shadow_Shader extends Shader
{ material()     // Define an internal class "Material" that stores the standard settings found in Phong lighting.
  { return new class Material       // Possible properties: ambient, diffusivity, specularity, smoothness, gouraud, texture.
      { constructor( shader )
          { Object.assign( this, { shader } );  // Assign defaults.
          }
      }( this);
  }
  map_attribute_name_to_buffer_name( name )                  // We'll pull single entries out per vertex by field name.  Map
    {                                                        // those names onto the vertex array names we'll pull them from.
      return { object_space_pos: "positions", normal: "normals", tex_coord: "texture_coords" }[ name ]; }   // Use a simple lookup table.
  shared_glsl_code()            // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
    { return `precision mediump float;
        `;
    }
  vertex_glsl_code()           // ********* VERTEX SHADER *********
    { return `
        attribute vec3 object_space_pos;

        uniform mat4 camera_transform, camera_model_transform, projection_camera_model_transform;
        uniform mat3 inverse_transpose_modelview;

        void main() { gl_Position = projection_camera_model_transform * vec4(object_space_pos, 1.0); }`;
    }
  fragment_glsl_code()           // ********* FRAGMENT SHADER ********* 
    {                            // A fragment is a pixel that's overlapped by the current triangle.
      return `
        void main() { gl_FragColor = vec4(gl_FragCoord.z,gl_FragCoord.z,gl_FragCoord.z,1); }
      `;

    }
    // Define how to synchronize our JavaScript's variables to the GPU's:
  update_GPU( g_state, model_transform, material, gpu = this.g_addrs, gl = this.gl )
    {                              // First, send the matrices to the GPU, additionally cache-ing some products of them we know we'll need:
      this.update_matrices( g_state, model_transform, gpu, gl );
    }
  update_matrices( g_state, model_transform, gpu, gl )                                    // Helper function for sending matrices to GPU.
    {                                                   // (PCM will mean Projection * Camera * Model)
      let [ P, C, M ]    = [ Mat4.orthographic( -40, 40, -40, 40, -10, 20 ), g_state.camera_transform, model_transform ],
            CM     =      C.times(  M ),
            PCM    =      P.times( CM ),
            inv_CM = Mat4.inverse( CM ).sub_block([0,0], [3,3]);
      gl.uniformMatrix4fv( gpu.camera_transform_loc,                  false, Mat.flatten_2D_to_1D(     C .transposed() ) );
      gl.uniformMatrix4fv( gpu.camera_model_transform_loc,            false, Mat.flatten_2D_to_1D(     CM.transposed() ) );
      gl.uniformMatrix4fv( gpu.projection_camera_model_transform_loc, false, Mat.flatten_2D_to_1D(    PCM.transposed() ) );
      gl.uniformMatrix3fv( gpu.inverse_transpose_modelview_loc,       false, Mat.flatten_2D_to_1D( inv_CM              ) );       
    }
}

class Phong_Shader1 extends Phong_Shader 
{ material( color, properties )     // Define an internal class "Material" that stores the standard settings found in Phong lighting.
  { return new class Material       // Possible properties: ambient, diffusivity, specularity, smoothness, gouraud, texture.
      { constructor( shader, color = Color.of( 0,0,0,1 ), ambient = 0, diffusivity = 1, specularity = 1, smoothness = 40 )
          { Object.assign( this, { shader, color, ambient, diffusivity, specularity, smoothness } );  // Assign defaults.
            Object.assign( this, properties );                                                        // Optionally override defaults.
          }
        override( properties )                      // Easily make temporary overridden versions of a base material, such as
          { const copied = new this.constructor();  // of a different color or diffusivity.  Use "opacity" to override only that.
            Object.assign( copied, this );
            Object.assign( copied, properties );
            copied.color = copied.color.copy();
            if( properties[ "opacity" ] != undefined ) copied.color[3] = properties[ "opacity" ];
            return copied;
          }
      }( this, color );
  }
  map_attribute_name_to_buffer_name( name )                  // We'll pull single entries out per vertex by field name.  Map
    {                                                        // those names onto the vertex array names we'll pull them from.
      return { object_space_pos: "positions", normal: "normals", tex_coord: "texture_coords" }[ name ]; }   // Use a simple lookup table.
  shared_glsl_code()            // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
    { return `precision mediump float;
        const int N_LIGHTS = 2;             // We're limited to only so many inputs in hardware.  Lights are costly (lots of sub-values).
        uniform float ambient, diffusivity, specularity, smoothness, animation_time, attenuation_factor[N_LIGHTS];
        uniform bool GOURAUD, COLOR_NORMALS, USE_TEXTURE;               // Flags for alternate shading methods
        uniform vec4 lightPosition[N_LIGHTS], lightColor[N_LIGHTS], shapeColor;
        varying vec3 N, E;                    // Specifier "varying" means a variable's final value will be passed from the vertex shader 
        varying vec2 f_tex_coord;             // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the 
        varying vec4 VERTEX_COLOR;            // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
        varying vec3 L[N_LIGHTS], H[N_LIGHTS];
        varying float dist[N_LIGHTS];
        varying vec4 shadowPos;
        
        vec3 phong_model_lights( vec3 N )
          { vec3 result = vec3(0.0);
            for(int i = 0; i < N_LIGHTS; i++)
              {
                float attenuation_multiplier = 1.0 / (1.0 + attenuation_factor[i] * (dist[i] * dist[i]));
                float diffuse  =      max( dot(N, L[i]), 0.0 );
                float specular = pow( max( dot(N, H[i]), 0.0 ), smoothness );

                result += attenuation_multiplier * ( shapeColor.xyz * diffusivity * diffuse + lightColor[i].xyz * specularity * specular );
              }
            return result;
          }
        `;
    }
  vertex_glsl_code()           // ********* VERTEX SHADER *********
    { return `
        attribute vec3 object_space_pos, normal;
        attribute vec2 tex_coord;

        uniform mat4 camera_transform, camera_model_transform, projection_camera_model_transform;
        uniform mat3 inverse_transpose_modelview;

        uniform mat4 lightMVP;
 
        const mat4 biasMatrix = mat4(0.5, 0.0, 0.0, 0.0, 
                                     0.0, 0.5, 0.0, 0.0, 
                                     0.0, 0.0, 0.5, 0.0, 
                                     0.5, 0.5, 0.5, 1.0);

        void main()
        { gl_Position = projection_camera_model_transform * vec4(object_space_pos, 1.0);     // The vertex's final resting place (in NDCS).
          shadowPos = biasMatrix * lightMVP * vec4(object_space_pos, 1.0);

          N = normalize( inverse_transpose_modelview * normal );                             // The final normal vector in screen space.
          f_tex_coord = tex_coord;                                         // Directly use original texture coords and interpolate between.
          
          if( COLOR_NORMALS )                                     // Bypass all lighting code if we're lighting up vertices some other way.
          { VERTEX_COLOR = vec4( N[0] > 0.0 ? N[0] : sin( animation_time * 3.0   ) * -N[0],             // In "normals" mode, 
                                 N[1] > 0.0 ? N[1] : sin( animation_time * 15.0  ) * -N[1],             // rgb color = xyz quantity.
                                 N[2] > 0.0 ? N[2] : sin( animation_time * 45.0  ) * -N[2] , 1.0 );     // Flash if it's negative.
            return;
          }
                                                  // The rest of this shader calculates some quantities that the Fragment shader will need:
          vec3 screen_space_pos = ( camera_model_transform * vec4(object_space_pos, 1.0) ).xyz;
          E = normalize( -screen_space_pos );

          for( int i = 0; i < N_LIGHTS; i++ )
          {            // Light positions use homogeneous coords.  Use w = 0 for a directional light source -- a vector instead of a point.
            L[i] = normalize( ( camera_transform * lightPosition[i] ).xyz - lightPosition[i].w * screen_space_pos );
            H[i] = normalize( L[i] + E );
            
            // Is it a point light source?  Calculate the distance to it from the object.  Otherwise use some arbitrary distance.
            dist[i]  = lightPosition[i].w > 0.0 ? distance((camera_transform * lightPosition[i]).xyz, screen_space_pos)
                                                : distance( attenuation_factor[i] * -lightPosition[i].xyz, object_space_pos.xyz );
          }

          if( GOURAUD )                 
          {                               
            VERTEX_COLOR      = vec4( shapeColor.xyz * ambient, shapeColor.w);
            VERTEX_COLOR.xyz += phong_model_lights( N );
          }
        }`;
    }
  fragment_glsl_code()           // ********* FRAGMENT SHADER ********* 
    {                            // A fragment is a pixel that's overlapped by the current triangle.
                                 // Fragments affect the final image or get discarded due to depth.
      return `
        uniform sampler2D texture;
        
        void main()
        { if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }

          vec3 fragmentDepth = shadowPos.xyz;
          fragmentDepth.y = -fragmentDepth.y;
          float shadowAcneRemover = 0.01;
          fragmentDepth.z -= shadowAcneRemover;
          float texelSize = 1.0 / 256.0;
  
          float amountInLight = 0.0;    

          for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
              float texelDepth = texture2D(texture, fragmentDepth.xy + vec2(x, y) * texelSize).z;
              if (fragmentDepth.z < texelDepth) {
                amountInLight += 1.0;
              }
            }
          }
          amountInLight /= 9.0;

          gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += amountInLight * phong_model_lights( N ); 
        }`;
    }
    // Define how to synchronize our JavaScript's variables to the GPU's:
  update_GPU( g_state, model_transform, material, gpu = this.g_addrs, gl = this.gl )
    {                              // First, send the matrices to the GPU, additionally cache-ing some products of them we know we'll need:
      this.update_matrices( g_state, model_transform, gpu, gl );
      gl.uniform1f ( gpu.animation_time_loc, g_state.animation_time / 1000 );

      if( g_state.gouraud === undefined ) { g_state.gouraud = g_state.color_normals = false; }    // Keep the flags seen by the shader 
      gl.uniform1i( gpu.GOURAUD_loc,        g_state.gouraud || material.gouraud );                // program up-to-date and make sure 
      gl.uniform1i( gpu.COLOR_NORMALS_loc,  g_state.color_normals );                              // they are declared.

      gl.uniform4fv( gpu.shapeColor_loc,     material.color       );    // Send the desired shape-wide material qualities 
      gl.uniform1f ( gpu.ambient_loc,        material.ambient     );    // to the graphics card, where they will tweak the
      gl.uniform1f ( gpu.diffusivity_loc,    material.diffusivity );    // Phong lighting formula.
      gl.uniform1f ( gpu.specularity_loc,    material.specularity );
      gl.uniform1f ( gpu.smoothness_loc,     material.smoothness  );

      if( material.texture )                           // NOTE: To signal not to draw a texture, omit the texture parameter from Materials.
      { gpu.shader_attributes["tex_coord"].enabled = true;
        gl.uniform1f ( gpu.USE_TEXTURE_loc, 1 );
        gl.bindTexture( gl.TEXTURE_2D, material.texture.id );
      }
      else  { gl.uniform1f ( gpu.USE_TEXTURE_loc, 0 );   gpu.shader_attributes["tex_coord"].enabled = false; }

      if( !g_state.lights.length )  return;
      var lightPositions_flattened = [], lightColors_flattened = [], lightAttenuations_flattened = [];
      for( var i = 0; i < 4 * g_state.lights.length; i++ )
        { lightPositions_flattened                  .push( g_state.lights[ Math.floor(i/4) ].position[i%4] );
          lightColors_flattened                     .push( g_state.lights[ Math.floor(i/4) ].color[i%4] );
          lightAttenuations_flattened[ Math.floor(i/4) ] = g_state.lights[ Math.floor(i/4) ].attenuation;
        }
      gl.uniform4fv( gpu.lightPosition_loc,       lightPositions_flattened );
      gl.uniform4fv( gpu.lightColor_loc,          lightColors_flattened );
      gl.uniform1fv( gpu.attenuation_factor_loc,  lightAttenuations_flattened );
    }
  update_matrices( g_state, model_transform, gpu, gl )                                    // Helper function for sending matrices to GPU.
    {                                                   // (PCM will mean Projection * Camera * Model)
      let [ P, C, M ]    = [ g_state.projection_transform, g_state.camera_transform, model_transform ],
            CM     =      C.times(  M ),
            PCM    =      P.times( CM ),
            inv_CM = Mat4.inverse( CM ).sub_block([0,0], [3,3]);
      let [ LP, LC, LM ]    = [ Mat4.orthographic( -40, 40, -40, 40, -10, 20 ), Mat4.look_at( g_state.lights[0].position, Vec.of( 0,0,0 ), Vec.of( 0,1,0 ) ), model_transform ],
            LCM     =      LC.times(  LM ),
            LPCM    =      LP.times( LCM );
            
                                                                  // Send the current matrices to the shader.  Go ahead and pre-compute
                                                                  // the products we'll need of the of the three special matrices and just
                                                                  // cache and send those.  They will be the same throughout this draw
                                                                  // call, and thus across each instance of the vertex shader.
                                                                  // Transpose them since the GPU expects matrices as column-major arrays.                                  
      gl.uniformMatrix4fv( gpu.camera_transform_loc,                  false, Mat.flatten_2D_to_1D(     C .transposed() ) );
      gl.uniformMatrix4fv( gpu.camera_model_transform_loc,            false, Mat.flatten_2D_to_1D(     CM.transposed() ) );
      gl.uniformMatrix4fv( gpu.projection_camera_model_transform_loc, false, Mat.flatten_2D_to_1D(    PCM.transposed() ) );
      gl.uniformMatrix3fv( gpu.inverse_transpose_modelview_loc,       false, Mat.flatten_2D_to_1D( inv_CM              ) ); 

      gl.uniformMatrix4fv( gpu.lightMVP_loc,                          false, Mat.flatten_2D_to_1D(   LPCM.transposed() ) );      
    }
}
