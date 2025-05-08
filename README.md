### !important
   Plugin is designed to basically go years without update so if that happens NO BIGGI if it breaks I'll be back I use obsidian everyday so I'll know

### What Why HOW

​    What: This plugin is basically a mix of the top 3 plugins Fullscreen plugins "might have overcomplicated things"

​    Why: 1. they haven't been updated in ages except this one

           2. NO VIM MODE SUPPORT 😭😭
              very solution sucked in there own ways

​    HOW: Since am not going to be updating no time I've opted to suffer my self and write this mostly using js

standards and only when really necessary obsidian API "Read the fun-fact"

### Updates And more coming soon
   - Multi windows support
   - Vertical tabs fix
   - Multilanguage support (donno yet)
   - mix and match of different modes 
   - convert to TS
   - Comments - EaZY Style comment mode
   - Better settings stucturing - Excalidraw - pdf++
   - fullscreen slow veryyyyy 
   - Maybe some hover support like since am from windows land!
   - Update defaults stop using prozen defaults
      - I want my titles back!
   - Make edge fade go back not in front and make it pure black 
   - Ability to use custom modes depending on notes/folder/tags/cssclass
   - Get rid of Debug mode with ts update / collapse it
   - Fix issue with native not toggling when in multi window mode "I have no idea"
   - add toggle to diable zen
   - Update main.js settings and update css to rgba for pureblack maybe some noise to blend that awful banding
   - Update naming confusion


### Plugins functionality ported over:

> Disclaimer: not every feature was ported over "Added some new once", also you'll have to figure out that language support ohhh amm burnt out
>
>   - https://github.com/cmoskvitin/obsidian-prozen
>   - https://github.com/Razumihin/obsidian-fullscreen-plugin/blob/main/main.ts
>   - https://github.com/DonkeyPacific/obsidian-full-screen-cross-platform-plugin

### List of features

   - Simulated 


### FunFact + more

   You might be wondering why vanilla js insted of type script, well this is actually my first obsidian plugin and by some stroke of luck i started by modifying [obsidian-fullscreen-plugin](https://github.com/Razumihin/obsidian-fullscreen-plugin/releases/tag/0.1.2) which probably is the only obsidian plugin that does not come with the esbuild comment and is just plain old js

   After about 2hrs+ of modifying the plugin with no luck battling fighting chromium to ignore the esc key when in full screenmode "which i already knew would not work" and some other fuctionalities I ended up giving up and decided to do some research and there i found [this crossplatform plugin](https://github.com/DonkeyPacific/obsidian-full-screen-cross-platform-plugin) it had a unique way of solving this issue insted of relying on Standard JavaScript & Browser/DOM APIs it uses a knock off pretty ingenious idea to mimic it but it wasn't quite there yet it needed to be complex yet fast wayyyy wayyy fast... and there i noticed the right way to make an obsidian plugin but i was to far into the weeds so i just flowed with it. how hard could it be right 😂

   Any ways considering i know for a fact as long as this plugin does not break am not fixing nothing about it I decided on A few things using Standard JavaScript & Browser/DOM APIs are a bigger piority than obsidians api this allow a higer chance of the plugin not breaking down "at least most of it" as obsidian changes over the years.

   also I mostly am just used to that side of the garden sooo. i'll say it's roughly 75% - 25% respectively
